import json
import logging
from dataclasses import dataclass
from enum import StrEnum
from typing import Annotated, Any

import openai
from pydantic import StringConstraints, TypeAdapter, ValidationError

from app.config import get_settings
from app.errors import ProblemError
from app.models.founder import (
    AskAmountInr,
    BusinessModel,
    City,
    CompetitorName,
    FounderProfileDraft,
    StartupName,
    TeamSize,
)
from app.models.taxonomy import FounderStage, Sector
from app.prompts.founder_extraction import PROMPT_VERSION, SYSTEM_PROMPT, build_user_prompt
from app.services.deck_reader import DeckText
from app.services.llm import get_llm_client

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class FounderExtraction:
    draft: FounderProfileDraft
    confidence_map: dict[str, float]
    raw: dict[str, Any]
    model: str
    prompt_version: str


_SCALAR_ADAPTERS: dict[str, TypeAdapter[Any]] = {
    "startup_name": TypeAdapter(StartupName),
    "ask_amount_inr": TypeAdapter(AskAmountInr),
    "team_size": TypeAdapter(TeamSize),
    "city": TypeAdapter(City),
    "description": TypeAdapter(
        Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=300)]
    ),
}
_ENUM_FIELDS: dict[str, type[StrEnum]] = {
    "sector": Sector,
    "stage": FounderStage,
    "business_model": BusinessModel,
}
_COMPETITORS: TypeAdapter[list[str]] = TypeAdapter(list[CompetitorName])


def _extraction_failed() -> ProblemError:
    return ProblemError(
        status=502,
        slug="extraction-failed",
        title="Auto-fill failed",
        detail="Auto-fill didn't work this time. You can enter your details manually.",
    )


def _match_enum(enum_cls: type[StrEnum], value: object) -> StrEnum | None:
    if not isinstance(value, str):
        return None
    wanted = value.strip().casefold()
    return next((member for member in enum_cls if member.value.casefold() == wanted), None)


def _clamp_confidence(score: object) -> float:
    if isinstance(score, bool) or not isinstance(score, int | float):
        return 0.5
    return max(0.0, min(1.0, float(score)))


def _parse_field(name: str, value: object) -> object:
    if name in _ENUM_FIELDS:
        return _match_enum(_ENUM_FIELDS[name], value)
    if name == "competitors":
        if not isinstance(value, list):
            return []
        try:
            return _COMPETITORS.validate_python(value[:3])
        except ValidationError:
            return []
    if value is None:
        return None
    try:
        return _SCALAR_ADAPTERS[name].validate_python(value)
    except ValidationError:
        return None


def _parse_extraction(raw: dict[str, Any]) -> tuple[FounderProfileDraft, dict[str, float]]:
    # Invalid individual fields become empty (confidence 0) instead of failing the whole draft.
    values: dict[str, object] = {}
    confidence: dict[str, float] = {}
    for name in FounderProfileDraft.model_fields:
        entry = raw.get(name)
        value = entry.get("value") if isinstance(entry, dict) else None
        parsed = _parse_field(name, value)
        has_value = parsed is not None and parsed != []
        values[name] = parsed
        confidence[name] = (
            _clamp_confidence(entry.get("confidence"))
            if has_value and isinstance(entry, dict)
            else 0.0
        )
    return FounderProfileDraft.model_validate(values), confidence


async def extract_founder_profile(deck: DeckText) -> FounderExtraction:
    settings = get_settings()
    try:
        completion = await get_llm_client().chat.completions.create(
            model=settings.groq_model,
            temperature=0,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": build_user_prompt(deck.text, deck.pages)},
            ],
        )
    except openai.APIError as exc:
        logger.warning("LLM extraction request failed: %s", type(exc).__name__)
        raise _extraction_failed() from exc

    content = completion.choices[0].message.content if completion.choices else None
    try:
        raw = json.loads(content or "")
    except json.JSONDecodeError as exc:
        logger.warning("LLM extraction returned non-JSON output")
        raise _extraction_failed() from exc
    if not isinstance(raw, dict):
        raise _extraction_failed()

    draft, confidence = _parse_extraction(raw)
    if not any(confidence.values()):
        raise _extraction_failed()

    return FounderExtraction(
        draft=draft,
        confidence_map=confidence,
        raw=raw,
        model=settings.groq_model,
        prompt_version=PROMPT_VERSION,
    )
