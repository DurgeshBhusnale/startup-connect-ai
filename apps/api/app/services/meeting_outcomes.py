"""S4: each party logs a private outcome after a meeting."""

import logging
from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.errors import ProblemError
from app.models.db import Match, Meeting, MeetingOutcome
from app.models.meetings import (
    MeetingOutcomeContext,
    MeetingOutcomeRequest,
    MeetingOutcomeResponse,
    OutcomeChoice,
)
from app.services.connections import load_other, require_viewer
from app.services.match_cards import profile_card
from app.services.meetings import meeting_item
from app.services.profile_snapshots import ProfileSnapshot

logger = logging.getLogger(__name__)


async def _party_meeting(
    session: AsyncSession, viewer: ProfileSnapshot, meeting_id: UUID
) -> tuple[Meeting, UUID]:
    meeting: Meeting | None = await session.get(Meeting, meeting_id)
    if meeting is None or viewer.profile_id not in (
        meeting.founder_profile_id,
        meeting.partner_profile_id,
    ):
        # Other people's meetings look the same as missing ones.
        raise ProblemError(
            status=404,
            slug="meeting-not-found",
            title="Meeting not found",
            detail="This meeting doesn't exist or isn't yours.",
        )
    other_id = (
        meeting.partner_profile_id
        if viewer.profile_id == meeting.founder_profile_id
        else meeting.founder_profile_id
    )
    return meeting, other_id


async def get_outcome_context(
    session: AsyncSession, clerk_user_id: str, meeting_id: UUID
) -> MeetingOutcomeContext:
    viewer = await require_viewer(session, clerk_user_id)
    meeting, other_id = await _party_meeting(session, viewer, meeting_id)
    other = await load_other(session, other_id)
    match_id: UUID | None = await session.scalar(
        select(Match.id).where(
            Match.from_profile_id == viewer.profile_id, Match.to_profile_id == other_id
        )
    )
    mine: MeetingOutcome | None = await session.scalar(
        select(MeetingOutcome).where(
            MeetingOutcome.meeting_id == meeting.id,
            MeetingOutcome.profile_id == viewer.profile_id,
        )
    )
    return MeetingOutcomeContext(
        meeting=meeting_item(meeting, viewer.profile_id),
        match_id=match_id,
        partner=profile_card(other),
        can_submit=meeting.scheduled_at <= datetime.now(UTC),
        my_outcome=OutcomeChoice(mine.outcome) if mine else None,
        my_notes=mine.notes if mine else None,
        submitted_at=mine.updated_at if mine else None,
    )


async def submit_outcome(
    session: AsyncSession, clerk_user_id: str, meeting_id: UUID, body: MeetingOutcomeRequest
) -> MeetingOutcomeResponse:
    viewer = await require_viewer(session, clerk_user_id)
    meeting, _ = await _party_meeting(session, viewer, meeting_id)
    now = datetime.now(UTC)
    if meeting.scheduled_at > now:
        raise ProblemError(
            status=409,
            slug="meeting-not-started",
            title="Meeting hasn't happened yet",
            detail="You can log an outcome once the meeting has started.",
        )

    # Changing your mind later is allowed: the latest answer replaces the earlier one.
    statement = insert(MeetingOutcome).values(
        meeting_id=meeting.id,
        profile_id=viewer.profile_id,
        outcome=body.outcome.value,
        notes=body.notes,
    )
    await session.execute(
        statement.on_conflict_do_update(
            index_elements=[MeetingOutcome.meeting_id, MeetingOutcome.profile_id],
            set_={"outcome": statement.excluded.outcome, "notes": statement.excluded.notes},
        )
    )
    if body.outcome != OutcomeChoice.CANCELLED and meeting.completed_at is None:
        meeting.completed_at = now
    # A late answer counts again, even after the meeting was marked outcome_unknown.
    meeting.outcome_unknown_at = None
    await session.commit()
    logger.info(
        "meeting_outcome_submitted outcome=%s has_notes=%s",
        body.outcome.value,
        body.notes is not None,
    )
    return MeetingOutcomeResponse(status="saved", outcome=body.outcome)


async def outcome_count(session: AsyncSession, meeting_id: UUID) -> int:
    count: int | None = await session.scalar(
        select(func.count()).where(MeetingOutcome.meeting_id == meeting_id)
    )
    return count or 0
