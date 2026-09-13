from datetime import UTC, datetime
from typing import Any

from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.errors import ProblemError
from app.models.db import AppRole, Profile, User
from app.models.founder import (
    AutobuildResponse,
    FounderDraftState,
    FounderProfileState,
    SaveProfileRequest,
    SaveProfileResponse,
)
from app.services.deck_reader import read_deck
from app.services.founder_extraction import extract_founder_profile


async def _get_founder_profile(session: AsyncSession, clerk_user_id: str) -> Profile:
    profile = await session.scalar(
        select(Profile)
        .join(User, Profile.user_id == User.id)
        .where(User.clerk_id == clerk_user_id, Profile.kind == AppRole.FOUNDER)
    )
    if profile is None:
        raise ProblemError(
            status=404,
            slug="no-founder-profile",
            title="Founder profile not found",
            detail="Choose the founder role before building a founder profile.",
        )
    return profile


def _draft_state(l1_data: dict[str, Any]) -> FounderDraftState | None:
    draft = l1_data.get("draft")
    if draft is None:
        return None
    try:
        return FounderDraftState.model_validate(draft)
    except ValidationError:
        return None


async def get_founder_state(session: AsyncSession, clerk_user_id: str) -> FounderProfileState:
    profile = await _get_founder_profile(session, clerk_user_id)
    return FounderProfileState(
        profile_id=profile.id,
        completed=profile.l1_completed_at is not None,
        draft=_draft_state(profile.l1_data),
    )


async def autobuild_founder_profile(
    session: AsyncSession,
    clerk_user_id: str,
    *,
    deck_bytes: bytes,
    deck_filename: str,
    linkedin_url: str,
) -> AutobuildResponse:
    profile = await _get_founder_profile(session, clerk_user_id)
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
    profile = await _get_founder_profile(session, clerk_user_id)
    previous = profile.l1_data
    draft = _draft_state(previous)

    l1_data: dict[str, Any] = payload.l1_data.model_dump(mode="json")
    if "raw_extraction" in previous:
        l1_data["raw_extraction"] = previous["raw_extraction"]
    if draft is not None:
        l1_data["extraction_confidence"] = draft.confidence_map
        l1_data["deck_filename"] = draft.deck_filename

    profile.l1_data = l1_data
    profile.l1_completed_at = profile.l1_completed_at or datetime.now(UTC)
    profile.embedding_v += 1
    await session.commit()
    return SaveProfileResponse(profile_id=profile.id)
