"""PRD M4 AC6: text moderation for posts with a policy-following safety model on Groq."""

import json
import logging
from dataclasses import dataclass
from typing import Literal

import openai

from app.config import get_settings
from app.prompts.moderation import SYSTEM_PROMPT, build_user_prompt
from app.services.llm import get_llm_client

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class ModerationVerdict:
    outcome: Literal["allowed", "blocked", "unavailable"]
    category: str | None = None


async def moderate_text(text: str) -> ModerationVerdict:
    content = text.strip()
    if not content:
        return ModerationVerdict("allowed")
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
                model=settings.moderation_model,
                temperature=0,
                response_format={"type": "json_object"},
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": build_user_prompt(content)},
                ],
                extra_body=extra_body,
            )
        )
    except openai.APIError as exc:
        logger.warning("Moderation unavailable: %s", type(exc).__name__)
        return ModerationVerdict("unavailable")

    raw_content = completion.choices[0].message.content if completion.choices else None
    try:
        raw = json.loads(raw_content or "")
    except json.JSONDecodeError:
        logger.warning("Moderation returned non-JSON output")
        return ModerationVerdict("unavailable")
    violation = raw.get("violation") if isinstance(raw, dict) else None
    category = raw.get("category") if isinstance(raw, dict) else None
    category_name = category if isinstance(category, str) and category.lower() != "none" else None
    if violation in (1, "1", True):
        return ModerationVerdict("blocked", category_name)
    if violation in (0, "0", False):
        return ModerationVerdict("allowed")
    logger.warning("Moderation returned an unexpected verdict")
    return ModerationVerdict("unavailable")
