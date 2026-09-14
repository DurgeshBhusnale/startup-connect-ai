"""Meeting reminders (S3 AC4) and outcome prompts (S4 AC1, AC4).

- Reminders 24 hours and 1 hour before a meeting.
- An outcome prompt 2 hours after it ends, a final reminder after 7 days, and after 14 days of
  silence from both sides the meeting is marked outcome_unknown.

In-app only until email and WhatsApp launch (Week 7+). Run every 15 minutes, e.g. a Railway cron
job: `python -m app.workers.meeting_notifications`.
"""

import asyncio
import logging
from collections.abc import Sequence
from datetime import UTC, datetime, timedelta
from uuid import UUID

from sqlalchemy import ColumnElement, and_, exists, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_session_factory
from app.models.db import Match, Meeting, MeetingOutcome
from app.models.notifications import NotificationKind
from app.services.connections import display_name
from app.services.meetings import format_ist
from app.services.notifications import notify
from app.services.profile_snapshots import ProfileSnapshot, load_by_ids

logger = logging.getLogger("startup_connect_api.meeting_notifications")

REMINDERS: tuple[tuple[str, timedelta, str], ...] = (
    ("reminder_24h_sent_at", timedelta(hours=24), "tomorrow"),
    ("reminder_1h_sent_at", timedelta(hours=1), "in about an hour"),
)
OUTCOME_PROMPT_AFTER = timedelta(hours=2)
OUTCOME_FINAL_REMINDER_AFTER = timedelta(days=7)
OUTCOME_UNKNOWN_AFTER = timedelta(days=14)


async def _parties(
    session: AsyncSession, meeting: Meeting
) -> list[tuple[ProfileSnapshot, ProfileSnapshot, UUID]]:
    """(me, other, my match id) for each visible side of the meeting."""
    founder_id, partner_id = meeting.founder_profile_id, meeting.partner_profile_id
    people = await load_by_ids(session, [founder_id, partner_id])
    rows = (
        await session.scalars(
            select(Match).where(
                or_(
                    and_(Match.from_profile_id == founder_id, Match.to_profile_id == partner_id),
                    and_(Match.from_profile_id == partner_id, Match.to_profile_id == founder_id),
                )
            )
        )
    ).all()
    match_ids = {(row.from_profile_id, row.to_profile_id): row.id for row in rows}
    parties = []
    for me_id, other_id in ((founder_id, partner_id), (partner_id, founder_id)):
        me, other = people.get(me_id), people.get(other_id)
        match_id = match_ids.get((me_id, other_id))
        # Deleted or paused accounts are invisible, so they get nothing.
        if me is not None and other is not None and match_id is not None:
            parties.append((me, other, match_id))
    return parties


async def _remind(session: AsyncSession, meeting: Meeting, phrase: str) -> int:
    sent = 0
    for me, other, match_id in await _parties(session, meeting):
        await notify(
            session,
            user_id=me.user_id,
            kind=NotificationKind.MEETING_REMINDER,
            title=f"Reminder: meeting with {display_name(other)} {phrase}",
            body=f"{format_ist(meeting.scheduled_at)} IST",
            action_label="View meeting",
            action_href=f"/matches/{match_id}/schedule",
        )
        sent += 1
    return sent


async def _prompt_outcome(session: AsyncSession, meeting: Meeting, *, final: bool) -> int:
    answered = set(
        (
            await session.scalars(
                select(MeetingOutcome.profile_id).where(MeetingOutcome.meeting_id == meeting.id)
            )
        ).all()
    )
    sent = 0
    for me, other, _ in await _parties(session, meeting):
        if me.profile_id in answered:
            continue
        name = display_name(other)
        await notify(
            session,
            user_id=me.user_id,
            kind=NotificationKind.MEETING_OUTCOME_PROMPT,
            title=(
                f"Last reminder: how did your meeting with {name} go?"
                if final
                else f"How did your meeting with {name} go?"
            ),
            body="Log a quick outcome. Your notes stay private.",
            action_label="Log outcome",
            action_href=f"/meetings/{meeting.id}/outcome",
        )
        sent += 1
    return sent


async def _due(session: AsyncSession, *conditions: ColumnElement[bool]) -> Sequence[Meeting]:
    return (
        await session.scalars(select(Meeting).where(Meeting.status == "scheduled", *conditions))
    ).all()


async def send_meeting_reminders(now: datetime | None = None) -> int:
    moment = now or datetime.now(UTC)
    sent = 0
    async with get_session_factory()() as session:
        for column_name, lead_time, phrase in REMINDERS:
            column = getattr(Meeting, column_name)
            due = await _due(
                session,
                column.is_(None),
                Meeting.scheduled_at > moment,
                Meeting.scheduled_at <= moment + lead_time,
            )
            for meeting in due:
                setattr(meeting, column_name, moment)
                # Booked inside this window: the booking was the heads-up, so skip this reminder.
                if meeting.created_at > meeting.scheduled_at - lead_time:
                    continue
                sent += await _remind(session, meeting, phrase)
        await session.commit()
    logger.info("meeting_reminder_sent channel=in_app count=%d", sent)
    return sent


async def send_outcome_prompts(now: datetime | None = None) -> tuple[int, int, int]:
    """Returns (prompts sent, final reminders sent, meetings marked outcome_unknown)."""
    moment = now or datetime.now(UTC)
    prompts = finals = unknown = 0
    pending = Meeting.outcome_unknown_at.is_(None)
    async with get_session_factory()() as session:
        for meeting in await _due(
            session,
            pending,
            Meeting.outcome_prompt_sent_at.is_(None),
            Meeting.ends_at <= moment - OUTCOME_PROMPT_AFTER,
        ):
            meeting.outcome_prompt_sent_at = moment
            # If the worker was down for a week, the final reminder below covers it.
            if meeting.ends_at > moment - OUTCOME_FINAL_REMINDER_AFTER:
                prompts += await _prompt_outcome(session, meeting, final=False)

        for meeting in await _due(
            session,
            pending,
            Meeting.outcome_reminder_sent_at.is_(None),
            Meeting.ends_at <= moment - OUTCOME_FINAL_REMINDER_AFTER,
        ):
            meeting.outcome_reminder_sent_at = moment
            if meeting.ends_at > moment - OUTCOME_UNKNOWN_AFTER:
                finals += await _prompt_outcome(session, meeting, final=True)

        silent = ~exists().where(MeetingOutcome.meeting_id == Meeting.id)
        for meeting in await _due(
            session, pending, silent, Meeting.ends_at <= moment - OUTCOME_UNKNOWN_AFTER
        ):
            meeting.outcome_unknown_at = moment
            unknown += 1
        await session.commit()
    logger.info("meeting_outcome_reminder_sent attempt=1 count=%d", prompts)
    logger.info("meeting_outcome_reminder_sent attempt=2 count=%d", finals)
    logger.info("meeting_outcome_unknown count=%d", unknown)
    return prompts, finals, unknown


async def run(now: datetime | None = None) -> None:
    await send_meeting_reminders(now)
    await send_outcome_prompts(now)


def main() -> None:
    logging.basicConfig(level=logging.INFO)
    asyncio.run(run())


if __name__ == "__main__":
    main()
