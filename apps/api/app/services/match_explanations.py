import hashlib
import json
import logging
import re
from collections.abc import Mapping
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any

import openai
from pydantic import TypeAdapter, ValidationError

from app.config import get_settings
from app.models.db import AppRole
from app.models.matches import Citation, ExplanationFull, FeatureDetail, StoredExplanation
from app.prompts.match_explanation import PROMPT_VERSION, SYSTEM_PROMPT, build_user_prompt
from app.services.llm import get_llm_client
from app.services.match_scoring import STRONG_SIGNAL
from app.services.profile_snapshots import ProfileSnapshot

logger = logging.getLogger(__name__)

SHORT_LIMIT = 200
BULLET_LIMIT = 240
NAME_LIMIT = 60
RETRY_AFTER = timedelta(minutes=15)
ELLIPSIS = "…"

_FEATURES: TypeAdapter[dict[str, FeatureDetail]] = TypeAdapter(dict[str, FeatureDetail])
_NUMBER = re.compile(r"\d+(?:[.,]\d+)*")
# Profiles don't state pronouns, so gendered guesses from names are rejected.
_GENDERED = re.compile(r"\b(?:he|she|him|her|his|hers|himself|herself)\b", re.IGNORECASE)


class ExplanationError(Exception):
    pass


@dataclass(frozen=True)
class ExplanationState:
    stored: StoredExplanation
    features: dict[str, FeatureDetail]
    needs_llm: bool


def features_hash(viewer_kind: AppRole, raw_features: Mapping[str, Any]) -> str:
    """Explanations are cached until the scoring signals (or the prompt) change."""
    payload = json.dumps(
        {"prompt": PROMPT_VERSION, "viewer": viewer_kind.value, "features": raw_features},
        sort_keys=True,
        ensure_ascii=False,
    )
    return hashlib.sha256(payload.encode()).hexdigest()


def truncate_words(text: str, limit: int = SHORT_LIMIT) -> str:
    collapsed = " ".join(text.split())
    if len(collapsed) <= limit:
        return collapsed
    cut = collapsed[: limit - 1].rsplit(" ", 1)[0].rstrip(" ,;:.")
    return f"{cut}{ELLIPSIS}"


def _positive_names(features: Mapping[str, FeatureDetail]) -> list[str]:
    ranked = sorted(
        (item for item in features.items() if item[1].score >= STRONG_SIGNAL),
        key=lambda item: item[1].score * item[1].weight,
        reverse=True,
    )
    return [name for name, _ in ranked]


def _concern_names(features: Mapping[str, FeatureDetail]) -> list[str]:
    return [name for name, feature in features.items() if feature.concern]


def _citations(features: Mapping[str, FeatureDetail], names: list[str]) -> list[Citation]:
    merged: dict[str, Citation] = {}
    for name in names:
        for citation in features[name].citations:
            entry = merged.setdefault(
                citation.value.casefold(), Citation(value=citation.value, sources=[])
            )
            if citation.source not in entry.sources:
                entry.sources.append(citation.source)
    return list(merged.values())


def template_explanation(features: Mapping[str, FeatureDetail], digest: str) -> StoredExplanation:
    """M8 AC4 fallback, built only from scoring signals."""
    positives = _positive_names(features)
    concerns = _concern_names(features)
    used = [*positives, *(name for name in concerns if name not in positives)]
    short = " · ".join(features[name].reason for name in positives[:3])
    return StoredExplanation(
        source="template",
        short=truncate_words(short or "Partial fit on your stated criteria"),
        full=ExplanationFull(
            positives=[features[name].reason for name in positives],
            concerns=[features[name].concern or "" for name in concerns],
        ),
        features_used=used,
        citations=_citations(features, used),
        features_hash=digest,
        generated_at=datetime.now(UTC),
    )


def explanation_state(
    raw_explanation: Mapping[str, Any] | None,
    raw_features: Mapping[str, Any],
    viewer_kind: AppRole,
) -> ExplanationState | None:
    try:
        features = _FEATURES.validate_python(raw_features)
    except ValidationError:
        return None
    digest = features_hash(viewer_kind, raw_features)
    try:
        stored = StoredExplanation.model_validate(raw_explanation) if raw_explanation else None
    except ValidationError:
        stored = None
    if stored is None or stored.features_hash != digest:
        return ExplanationState(template_explanation(features, digest), features, needs_llm=True)
    retry_due = (
        stored.llm_failed_at is None or datetime.now(UTC) - stored.llm_failed_at > RETRY_AFTER
    )
    return ExplanationState(stored, features, needs_llm=stored.source == "template" and retry_due)


def _party(snapshot: ProfileSnapshot) -> dict[str, str]:
    party = {"role": snapshot.kind.value}
    if snapshot.display_name and snapshot.display_name.split():
        party["first_name"] = snapshot.display_name.split()[0][:NAME_LIMIT]
    if snapshot.founder is not None:
        party["startup"] = snapshot.founder.startup_name
    return party


def _allowed_numbers(features: Mapping[str, FeatureDetail]) -> set[str]:
    facts = " ".join(
        " ".join([feature.reason, feature.concern or "", *(c.value for c in feature.citations)])
        for feature in features.values()
    )
    return set(_NUMBER.findall(facts))


def _grounded(text: str, allowed_numbers: set[str]) -> bool:
    # Every number the LLM writes must come from a scoring fact (hallucination guard).
    if _GENDERED.search(text):
        return False
    return all(token in allowed_numbers for token in _NUMBER.findall(text))


def _signal_texts(
    raw: object, allowed_names: list[str], allowed_numbers: set[str]
) -> dict[str, str]:
    texts: dict[str, str] = {}
    if not isinstance(raw, list):
        return texts
    for entry in raw:
        if not isinstance(entry, dict):
            continue
        name, text = entry.get("signal"), entry.get("text")
        # Items citing a signal outside the allowlist are stripped (PRD M8 edge case).
        if not isinstance(name, str) or name not in allowed_names or name in texts:
            continue
        if not isinstance(text, str):
            continue
        cleaned = " ".join(text.split())
        if cleaned and len(cleaned) <= BULLET_LIMIT and _grounded(cleaned, allowed_numbers):
            texts[name] = cleaned
    return texts


async def generate_llm_explanation(
    viewer: ProfileSnapshot, candidate: ProfileSnapshot, state: ExplanationState
) -> StoredExplanation:
    settings = get_settings()
    features = state.features
    positives = _positive_names(features)
    concerns = _concern_names(features)
    payload: dict[str, object] = {
        "viewer": _party(viewer),
        "matched_party": _party(candidate),
        "positive_signals": [
            {"id": name, "label": features[name].label, "fact": features[name].reason}
            for name in positives
        ],
        "concern_signals": [
            {"id": name, "label": features[name].label, "fact": features[name].concern}
            for name in concerns
        ],
    }
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
                temperature=0.2,
                response_format={"type": "json_object"},
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": build_user_prompt(payload)},
                ],
                extra_body=extra_body,
            )
        )
    except openai.APIError as exc:
        raise ExplanationError(type(exc).__name__) from exc

    content = completion.choices[0].message.content if completion.choices else None
    try:
        raw = json.loads(content or "")
    except json.JSONDecodeError as exc:
        raise ExplanationError("LLM returned non-JSON output") from exc
    if not isinstance(raw, dict):
        raise ExplanationError("LLM returned an unexpected shape")

    allowed_numbers = _allowed_numbers(features)
    positive_texts = _signal_texts(raw.get("positives"), positives, allowed_numbers)
    concern_texts = _signal_texts(raw.get("concerns"), concerns, allowed_numbers)
    raw_short = raw.get("short")
    short = (
        truncate_words(raw_short)
        if isinstance(raw_short, str)
        and raw_short.strip()
        and _grounded(raw_short, allowed_numbers)
        else None
    )
    if short is None and not positive_texts and not concern_texts:
        raise ExplanationError("LLM output had no grounded content")

    template = state.stored
    # Signals the LLM skipped or got wrong keep their template sentence, so every factor is listed.
    return template.model_copy(
        update={
            "source": "llm",
            "short": short or template.short,
            "full": ExplanationFull(
                positives=[positive_texts.get(name, features[name].reason) for name in positives],
                concerns=[
                    concern_texts.get(name, features[name].concern or "") for name in concerns
                ],
            ),
            "generated_at": datetime.now(UTC),
            "llm_failed_at": None,
        }
    )
