from datetime import UTC, datetime
from typing import Any

from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.errors import ProblemError
from app.models.db import AppRole, MentorExpertise, Profile
from app.models.mentor import (
    LinkedInVerificationRequest,
    MentorExpertiseData,
    MentorExpertiseRequest,
    MentorExpertiseResponse,
    MentorProfileState,
    MentorVerificationState,
    ReferencesVerificationRequest,
    VerificationResponse,
)
from app.services.profile_lookup import get_role_profile, l1_text


async def _get_expertise(session: AsyncSession, profile: Profile) -> MentorExpertise | None:
    expertise: MentorExpertise | None = await session.scalar(
        select(MentorExpertise).where(MentorExpertise.profile_id == profile.id)
    )
    return expertise


def _expertise_data(expertise: MentorExpertise | None) -> MentorExpertiseData | None:
    if expertise is None:
        return None
    try:
        return MentorExpertiseData.model_validate(
            {
                "areas": expertise.areas,
                "stages": expertise.stages,
                "availability": expertise.availability.get("cadence"),
                "session_fee": expertise.session_fee,
            }
        )
    except ValidationError:
        return None


def _verification_state(raw: object) -> MentorVerificationState | None:
    if not isinstance(raw, dict):
        return None
    emails = raw.get("reference_emails")
    try:
        return MentorVerificationState.model_validate(
            {
                "method": raw.get("method"),
                "status": raw.get("status"),
                "linkedin_url": raw.get("linkedin_url"),
                "reference_count": len(emails) if isinstance(emails, list) else 0,
                "requested_at": raw.get("requested_at"),
            }
        )
    except ValidationError:
        return None


async def get_mentor_state(session: AsyncSession, clerk_user_id: str) -> MentorProfileState:
    profile = await get_role_profile(session, clerk_user_id, AppRole.MENTOR)
    expertise = await _get_expertise(session, profile)
    return MentorProfileState(
        profile_id=profile.id,
        completed=profile.l1_completed_at is not None,
        expertise=_expertise_data(expertise),
        verification=_verification_state(profile.l1_data.get("verification")),
        bio=l1_text(profile.l1_data, "bio"),
    )


async def save_expertise(
    session: AsyncSession, clerk_user_id: str, payload: MentorExpertiseRequest
) -> MentorExpertiseResponse:
    profile = await get_role_profile(session, clerk_user_id, AppRole.MENTOR)
    values: dict[str, Any] = {
        "areas": [area.value for area in payload.areas],
        "stages": [stage.value for stage in payload.stages],
        "availability": {"cadence": payload.availability.value},
        "session_fee": payload.session_fee,
    }
    await session.execute(
        insert(MentorExpertise)
        .values(profile_id=profile.id, **values)
        .on_conflict_do_update(index_elements=[MentorExpertise.profile_id], set_=values)
    )
    if profile.l1_completed_at is None:
        profile.l1_completed_at = datetime.now(UTC)
    profile.embedding_v += 1
    await session.commit()
    return MentorExpertiseResponse(mentor_id=profile.id)


async def request_verification(
    session: AsyncSession,
    clerk_user_id: str,
    payload: LinkedInVerificationRequest | ReferencesVerificationRequest,
) -> VerificationResponse:
    profile = await get_role_profile(session, clerk_user_id, AppRole.MENTOR)
    if await _get_expertise(session, profile) is None:
        raise ProblemError(
            status=409,
            slug="expertise-required",
            title="Expertise required",
            detail="Save your mentor expertise before requesting verification.",
        )

    # Stored for manual review; no outreach to references and no badge until M6 ships.
    record: dict[str, Any] = {
        "method": payload.method,
        "status": "pending",
        "requested_at": datetime.now(UTC).isoformat(),
        "linkedin_url": None,
        "reference_emails": [],
    }
    if isinstance(payload, LinkedInVerificationRequest):
        record["linkedin_url"] = payload.payload.linkedin_url
    else:
        record["reference_emails"] = payload.payload.reference_emails
    profile.l1_data = {**profile.l1_data, "verification": record}
    await session.commit()
    return VerificationResponse(status="pending")
