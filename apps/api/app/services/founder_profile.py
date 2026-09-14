from datetime import UTC, datetime
from typing import Any

from pydantic import ValidationError
from sqlalchemy.ext.asyncio import AsyncSession

from app.errors import ProblemError
from app.models.db import AppRole
from app.models.founder import (
    AutobuildResponse,
    FounderDraftState,
    FounderL1Data,
    FounderProfileState,
    SaveProfileRequest,
    SaveProfileResponse,
)
from app.services.deck_reader import read_deck
from app.services.founder_extraction import extract_founder_profile
from app.services.profile_lookup import get_role_profile, l1_text

# Keys in l1_data that are not L1 fields and must survive a profile save.
_PRESERVED_KEYS = ("raw_extraction", "extraction_confidence", "deck_filename", "bio", "website")


def _draft_state(l1_data: dict[str, Any]) -> FounderDraftState | None:
    draft = l1_data.get("draft")
    if draft is None:
        return None
    try:
        return FounderDraftState.model_validate(draft)
    except ValidationError:
        return None


def saved_founder_l1(l1_data: dict[str, Any]) -> FounderL1Data | None:
    values = {key: l1_data[key] for key in FounderL1Data.model_fields if key in l1_data}
    if not values:
        return None
    try:
        return FounderL1Data.model_validate(values)
    except ValidationError:
        return None


async def get_founder_state(session: AsyncSession, clerk_user_id: str) -> FounderProfileState:
    profile = await get_role_profile(session, clerk_user_id, AppRole.FOUNDER)
    return FounderProfileState(
        profile_id=profile.id,
        completed=profile.l1_completed_at is not None,
        draft=_draft_state(profile.l1_data),
        l1_data=saved_founder_l1(profile.l1_data) if profile.l1_completed_at else None,
        bio=l1_text(profile.l1_data, "bio"),
        website=l1_text(profile.l1_data, "website"),
        ask_pin=profile.ask_pin,
    )


async def autobuild_founder_profile(
    session: AsyncSession,
    clerk_user_id: str,
    *,
    deck_bytes: bytes,
    deck_filename: str,
    linkedin_url: str,
) -> AutobuildResponse:
    profile = await get_role_profile(session, clerk_user_id, AppRole.FOUNDER)
    if profile.l1_completed_at is not None:
        raise ProblemError(
            status=409,
            slug="profile-already-completed",
            title="Profile already completed",
            detail="Your founder profile is already set up.",
        )
    # Release the pooled connection before the slow PDF + LLM work.
    await session.commit()

    deck = await read_deck(deck_bytes)
    extraction = await extract_founder_profile(deck)
    draft_state = FounderDraftState(
        profile_draft=extraction.draft,
        confidence_map=extraction.confidence_map,
        deck_filename=deck_filename,
        deck_pages=deck.pages,
        linkedin_url=linkedin_url,
    )
    profile.l1_data = {
        **profile.l1_data,
        "draft": draft_state.model_dump(mode="json"),
        "raw_extraction": {
            "model": extraction.model,
            "prompt_version": extraction.prompt_version,
            "extracted_at": datetime.now(UTC).isoformat(),
            "deck_pages": deck.pages,
            "output": extraction.raw,
        },
    }
    await session.commit()
    return AutobuildResponse(
        profile_draft=extraction.draft, confidence_map=extraction.confidence_map
    )


async def save_founder_profile(
    session: AsyncSession, clerk_user_id: str, payload: SaveProfileRequest
) -> SaveProfileResponse:
    profile = await get_role_profile(session, clerk_user_id, AppRole.FOUNDER)
    previous = profile.l1_data
    draft = _draft_state(previous)
    now = datetime.now(UTC).isoformat()

    new_values: dict[str, Any] = payload.l1_data.model_dump(mode="json")
    previous_stamps = previous.get("field_updated_at")
    # Per-field "last changed" times drive the M6 stale self-reported claim note.
    field_updated_at: dict[str, Any] = (
        dict(previous_stamps) if isinstance(previous_stamps, dict) else {}
    )
    for key, value in new_values.items():
        if key not in field_updated_at or previous.get(key) != value:
            field_updated_at[key] = now

    l1_data: dict[str, Any] = {**new_values, "field_updated_at": field_updated_at}
    for key in _PRESERVED_KEYS:
        if key in previous:
            l1_data[key] = previous[key]
    if draft is not None:
        l1_data["extraction_confidence"] = draft.confidence_map
        l1_data["deck_filename"] = draft.deck_filename

    profile.l1_data = l1_data
    profile.l1_completed_at = profile.l1_completed_at or datetime.now(UTC)
    profile.embedding_v += 1
    await session.commit()
    return SaveProfileResponse(profile_id=profile.id)
