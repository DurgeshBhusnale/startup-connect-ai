from datetime import UTC, datetime, timedelta
from uuid import UUID

from sqlalchemy import exists, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased

from app.errors import ProblemError
from app.models.db import (
    AppRole,
    InvestorThesis,
    Match,
    MentorExpertise,
    PriorInvestment,
    Profile,
    User,
)
from app.models.founder import FounderL1Data
from app.models.profile import BadgesResponse

STALE_AFTER = timedelta(days=60)


def _parse_timestamp(value: object) -> datetime | None:
    if not isinstance(value, str):
        return None
    try:
        parsed = datetime.fromisoformat(value)
    except ValueError:
        return None
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=UTC)


async def _claim_timestamps(session: AsyncSession, profile: Profile) -> dict[str, datetime]:
    result: dict[str, datetime] = {}
    if profile.kind == AppRole.FOUNDER:
        raw = profile.l1_data.get("field_updated_at")
        stamps = raw if isinstance(raw, dict) else {}
        for key in FounderL1Data.model_fields:
            if key not in profile.l1_data:
                continue
            updated = _parse_timestamp(stamps.get(key)) or profile.l1_completed_at
            if updated is not None:
                result[f"l1.{key}"] = updated
        return result

    if profile.kind == AppRole.INVESTOR:
        thesis_updated: datetime | None = await session.scalar(
            select(InvestorThesis.updated_at).where(InvestorThesis.profile_id == profile.id)
        )
        if thesis_updated is not None:
            result["thesis"] = thesis_updated
        latest_deal: datetime | None = await session.scalar(
            select(func.max(PriorInvestment.created_at)).where(
                PriorInvestment.profile_id == profile.id
            )
        )
        if latest_deal is not None:
            result["prior_investments"] = latest_deal
        return result

    expertise_updated: datetime | None = await session.scalar(
        select(MentorExpertise.updated_at).where(MentorExpertise.profile_id == profile.id)
    )
    if expertise_updated is not None:
        result["expertise"] = expertise_updated
    return result


async def badges_for_profile(session: AsyncSession, profile: Profile) -> BadgesResponse:
    timestamps = await _claim_timestamps(session, profile)
    cutoff = datetime.now(UTC) - STALE_AFTER
    stale = sorted(item for item, updated in timestamps.items() if updated < cutoff)
    # verified_items fill in with the M5 momentum aggregator; endorsed_items with S8 endorsements.
    return BadgesResponse(
        verified_items=[],
        endorsed_items=[],
        self_reported_stale=stale,
        last_updated={item: timestamps[item] for item in stale},
    )


async def get_profile_badges(
    session: AsyncSession, clerk_user_id: str, profile_id: UUID
) -> BadgesResponse:
    # Visible to the owner and to anyone the profile has been matched with (M10 AC7).
    viewer_profile = aliased(Profile)
    viewer_profile_ids = (
        select(viewer_profile.id)
        .join(User, viewer_profile.user_id == User.id)
        .where(User.clerk_id == clerk_user_id)
    )
    matched = exists().where(
        Match.from_profile_id.in_(viewer_profile_ids), Match.to_profile_id == Profile.id
    )
    profile: Profile | None = await session.scalar(
        select(Profile).where(
            Profile.id == profile_id, or_(Profile.id.in_(viewer_profile_ids), matched)
        )
    )
    if profile is None:
        raise ProblemError(
            status=404,
            slug="profile-not-found",
            title="Profile not found",
            detail="This profile doesn't exist or isn't visible to you.",
        )
    return await badges_for_profile(session, profile)
