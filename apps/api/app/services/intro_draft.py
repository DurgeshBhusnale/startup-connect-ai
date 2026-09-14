"""PRD S5 (used by M9 AC4): AI-drafted intro message for the Intro Request Modal (S-16)."""

import json
import logging
import re
from time import perf_counter
from typing import Literal
from uuid import UUID

import openai
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.feedback import INTRO_MESSAGE_MAX, IntroDraftRequest, IntroDraftResponse
from app.models.taxonomy import STAGE_LABELS
from app.prompts.intro_draft import SYSTEM_PROMPT, build_user_prompt
from app.services.connections import (
    first_name,
    founders_only,
    match_not_found,
    owned_match,
    require_viewer,
)
from app.services.llm import get_llm_client
from app.services.match_explanations import (
    explanation_state,
    is_grounded,
    numbers_in,
    positive_names,
)
from app.services.match_scoring import format_inr
from app.services.profile_snapshots import load_by_ids

logger = logging.getLogger(__name__)

_LINK = re.compile(r"https?://|www\.", re.IGNORECASE)
_BLANK_LINES = re.compile(r"\n{3,}")
# Numbers the draft may use beyond the facts (the "20-minute call" ask).
_EXTRA_NUMBERS = {"20"}


class DraftUnavailableError(Exception):
    pass


def _clean(message: str) -> str:
    lines = [line.strip() for line in message.replace("\r\n", "\n").split("\n")]
    return _BLANK_LINES.sub("\n\n", "\n".join(lines)).strip()


async def _generate(payload: dict[str, object]) -> str:
    settings = get_settings()
    extra_body = (
        {"reasoning_effort": settings.llm_reasoning_effort}
        if settings.llm_reasoning_effort
        else None
    )
    try:
        completion = await (
            get_llm_client()
            .with_options(timeout=settings.explanation_timeout_seconds, max_retries=0)
            .chat.completions.create(
                model=settings.groq_model,
                temperature=0.7,
                response_format={"type": "json_object"},
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": build_user_prompt(payload)},
                ],
                extra_body=extra_body,
            )
        )
    except openai.APIError as exc:
        raise DraftUnavailableError(type(exc).__name__) from exc

    content = completion.choices[0].message.content if completion.choices else None
    try:
        raw = json.loads(content or "")
    except json.JSONDecodeError as exc:
        raise DraftUnavailableError("LLM returned non-JSON output") from exc
    message = raw.get("message") if isinstance(raw, dict) else None
    if not isinstance(message, str):
        raise DraftUnavailableError("LLM output had no message")

    cleaned = _clean(message)
    allowed = numbers_in(json.dumps(payload, ensure_ascii=False)) | _EXTRA_NUMBERS
    if not cleaned or len(cleaned) > INTRO_MESSAGE_MAX:
        raise DraftUnavailableError("Draft was empty or too long")
    # Filters links, invented numbers, and gendered pronouns (S5 edge case: off-topic content).
    if _LINK.search(cleaned) or not is_grounded(cleaned, allowed):
        raise DraftUnavailableError("Draft failed grounding checks")
    return cleaned


async def draft_intro(
    session: AsyncSession, clerk_user_id: str, match_id: UUID, body: IntroDraftRequest
) -> IntroDraftResponse:
    viewer = await require_viewer(session, clerk_user_id)
    founder = viewer.founder
    if founder is None:
        raise founders_only()
    match = await owned_match(session, viewer, match_id)
    partner = (await load_by_ids(session, [match.to_profile_id])).get(match.to_profile_id)
    if partner is None or not partner.matchable:
        raise match_not_found()

    state = explanation_state(match.explanation, match.features, viewer.kind)
    signals = (
        [state.features[name].reason for name in positive_names(state.features)] if state else []
    )
    sender: dict[str, object] = {
        "startup": founder.startup_name,
        "description": founder.description,
        "sector": founder.sector.value,
        "stage": STAGE_LABELS[founder.stage.value],
        "city": founder.city,
        "raising": format_inr(founder.ask_amount_inr),
        "business_model": founder.business_model.value,
        "team_size": founder.team_size,
    }
    if viewer.display_name:
        sender["first_name"] = first_name(viewer)
    recipient: dict[str, object] = {"role": partner.kind.value}
    if partner.display_name:
        recipient["first_name"] = first_name(partner)
    payload: dict[str, object] = {
        "sender": sender,
        "recipient": recipient,
        "match_signals": signals,
    }

    started = perf_counter()
    draft = ""
    source: Literal["llm", "unavailable"] = "unavailable"
    try:
        draft = await _generate(payload)
        source = "llm"
    except DraftUnavailableError as exc:
        # PRD S5 AC4: the modal opens with an empty message the founder can write themselves.
        logger.warning("Intro draft unavailable for match %s: %s", match.id, exc)
    logger.info(
        "intro_draft_generated match_id=%s source=%s duration_ms=%d",
        match.id,
        source,
        (perf_counter() - started) * 1000,
    )
    if body.attempt > 0:
        logger.info("intro_draft_regenerated match_id=%s attempt=%d", match.id, body.attempt)
    return IntroDraftResponse(draft=draft, source=source)
