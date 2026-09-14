"""Meeting reminders 24 hours and 1 hour before a meeting (S3 AC4).

In-app only until email and WhatsApp launch (Week 7+). Run every 15 minutes, e.g. a Railway cron
job: `python -m app.workers.meeting_notifications`.
"""

import asyncio
import logging
from datetime import UTC, datetime, timedelta

from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_session_factory
from app.models.db import Match, Meeting
from app.models.notifications import NotificationKind
from app.services.connections import display_name
from app.services.meetings import format_ist
from app.services.notifications import notify
from app.services.profile_snapshots import load_by_ids

logger = logging.getLogger("startup_connect_api.meeting_notifications")

REMINDERS: tuple[tuple[str, timedelta, str], ...] = (
    ("reminder_24h_sent_at", timedelta(hours=24), "tomorrow"),
    ("reminder_1h_sent_at", timedelta(hours=1), "in about an hour"),
)


async def _remind(session: AsyncSession, meeting: Meeting, phrase: str) -> int:
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
    sent = 0
    for me_id, other_id in ((founder_id, partner_id), (partner_id, founder_id)):
        me, other = people.get(me_id), people.get(other_id)
        match_id = match_ids.get((me_id, other_id))
        # Deleted or paused accounts are invisible, so they get no reminder.
        if me is None or other is None or match_id is None:
            continue
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


async def send_meeting_reminders(now: datetime | None = None) -> int:
    moment = now or datetime.now(UTC)
    sent = 0
    async with get_session_factory()() as session:
        for column_name, lead_time, phrase in REMINDERS:
            column = getattr(Meeting, column_name)
            due = (
                await session.scalars(
                    select(Meeting).where(
                        Meeting.status == "scheduled",
                        column.is_(None),
                        Meeting.scheduled_at > moment,
                        Meeting.scheduled_at <= moment + lead_time,
                    )
                )
            ).all()
            for meeting in due:
                setattr(meeting, column_name, moment)
                # Booked inside this window: the booking was the heads-up, so skip this reminder.
                if meeting.created_at > meeting.scheduled_at - lead_time:
                    continue
                sent += await _remind(session, meeting, phrase)
        await session.commit()
    logger.info("meeting_reminder_sent channel=in_app count=%d", sent)
    return sent


def main() -> None:
    logging.basicConfig(level=logging.INFO)
    asyncio.run(send_meeting_reminders())


if __name__ == "__main__":
    main()
