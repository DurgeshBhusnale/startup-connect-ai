"""S3: meetings between mutual matches, booked through an embedded Cal.com widget (W5)."""

import logging
from datetime import UTC, datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.errors import ProblemError
from app.models.db import Match, Meeting, Notification, Profile
from app.models.feedback import ConnectionStatus
from app.models.matches import MeetingItem
from app.models.meetings import (
    MeetingCreatedResponse,
    MeetingCreateRequest,
    NudgeResponse,
    SchedulingContext,
    SchedulingLinkRequest,
    SchedulingLinkResponse,
)
from app.models.notifications import NotificationKind
from app.services.connections import (
    display_name,
    ensure_match_row,
    intro_for,
    load_other,
    owned_match,
    pair_ids,
    require_viewer,
)
from app.services.match_cards import profile_card
from app.services.notifications import notify
from app.services.privacy import require_user
from app.services.profile_lookup import get_role_profile
from app.services.profile_snapshots import ProfileSnapshot

logger = logging.getLogger(__name__)

# India has no daylight saving, so a fixed offset is exact (and needs no tzdata on Windows).
IST = timezone(timedelta(hours=5, minutes=30), "IST")
NUDGE_COOLDOWN = timedelta(hours=24)


def format_ist(moment: datetime) -> str:
    """'Tue, 26 Aug at 4:00 PM' in IST."""
    local = moment.astimezone(IST)
    return f"{local:%a, %d %b} at {local:%I:%M %p}".replace(" 0", " ")


def booking_url(cal_link: str | None) -> str | None:
    return f"https://cal.com/{cal_link}" if cal_link else None


def _not_mutual() -> ProblemError:
    return ProblemError(
        status=409,
        slug="not-mutual",
        title="Not connected yet",
        detail="You can schedule a meeting once you're a mutual match.",
    )


def meeting_item(meeting: Meeting, viewer_profile_id: UUID) -> MeetingItem:
    length = meeting.ends_at - meeting.scheduled_at
    return MeetingItem(
        meeting_id=meeting.id,
        scheduled_at=meeting.scheduled_at,
        ends_at=meeting.ends_at,
        duration_minutes=max(1, int(length.total_seconds() // 60)),
        title=meeting.title,
        video_url=meeting.video_url,
        status="cancelled" if meeting.status == "cancelled" else "scheduled",
        host_is_me=meeting.host_profile_id == viewer_profile_id,
        booked_by_me=meeting.booked_by_profile_id == viewer_profile_id,
    )


async def upcoming_meeting(
    session: AsyncSession, viewer: ProfileSnapshot, match: Match
) -> MeetingItem | None:
    founder_id, partner_id = pair_ids(viewer, match.to_profile_id)
    meeting: Meeting | None = await session.scalar(
        select(Meeting)
        .where(
            Meeting.founder_profile_id == founder_id,
            Meeting.partner_profile_id == partner_id,
            Meeting.status == "scheduled",
            Meeting.ends_at > datetime.now(UTC),
        )
        .order_by(Meeting.scheduled_at)
        .limit(1)
    )
    return meeting_item(meeting, viewer.profile_id) if meeting is not None else None


async def _cal_links(session: AsyncSession, *profile_ids: UUID) -> dict[UUID, str | None]:
    rows = await session.execute(
        select(Profile.id, Profile.cal_link).where(Profile.id.in_(profile_ids))
    )
    return dict(rows.tuples().all())


async def get_scheduling_context(
    session: AsyncSession, clerk_user_id: str, match_id: UUID
) -> SchedulingContext:
    viewer = await require_viewer(session, clerk_user_id)
    match = await owned_match(session, viewer, match_id)
    other = await load_other(session, match.to_profile_id)
    intro = await intro_for(session, *pair_ids(viewer, match.to_profile_id))
    connection = ConnectionStatus(intro.status) if intro else ConnectionStatus.NONE
    mutual = connection == ConnectionStatus.ACCEPTED
    links = await _cal_links(session, viewer.profile_id, other.profile_id)
    my_link, partner_link = links.get(viewer.profile_id), links.get(other.profile_id)
    host = "partner" if partner_link else "me" if my_link else None
    return SchedulingContext(
        match_id=match.id,
        connection=connection,
        can_schedule=mutual,
        partner=profile_card(other),
        partner_cal_link=partner_link if mutual else None,
        my_cal_link=my_link,
        host=host if mutual else None,
        upcoming_meeting=await upcoming_meeting(session, viewer, match) if mutual else None,
    )


async def create_meeting(
    session: AsyncSession, clerk_user_id: str, body: MeetingCreateRequest
) -> MeetingCreatedResponse:
    viewer = await require_viewer(session, clerk_user_id)
    match = await owned_match(session, viewer, body.match_id)
    other = await load_other(session, match.to_profile_id)
    founder_id, partner_id = pair_ids(viewer, match.to_profile_id)
    intro = await intro_for(session, founder_id, partner_id)
    if intro is None or intro.status != ConnectionStatus.ACCEPTED:
        raise _not_mutual()

    # The embed can report the same booking twice (e.g. a re-render): stay idempotent.
    existing: Meeting | None = await session.scalar(
        select(Meeting).where(Meeting.cal_booking_uid == body.cal_event_id)
    )
    if existing is not None:
        if (existing.founder_profile_id, existing.partner_profile_id) != (founder_id, partner_id):
            raise ProblemError(
                status=409,
                slug="booking-conflict",
                title="Booking already recorded",
                detail="This booking belongs to a different match.",
            )
        return MeetingCreatedResponse(meeting_id=existing.id)

    host_profile_id = other.profile_id if body.host == "partner" else viewer.profile_id
    if not (await _cal_links(session, host_profile_id)).get(host_profile_id):
        raise ProblemError(
            status=409,
            slug="no-scheduling-link",
            title="No booking link",
            detail="That calendar isn't linked anymore. Reload the page and try again.",
        )
    ends_at = body.ends_at or body.scheduled_at + timedelta(minutes=30)
    meeting = Meeting(
        founder_profile_id=founder_id,
        partner_profile_id=partner_id,
        booked_by_profile_id=viewer.profile_id,
        host_profile_id=host_profile_id,
        cal_booking_uid=body.cal_event_id,
        title=body.title,
        scheduled_at=body.scheduled_at,
        ends_at=ends_at,
        video_url=body.video_url,
    )
    session.add(meeting)
    await session.flush()
    meeting_id = meeting.id
    other_match = await ensure_match_row(session, match, other)
    minutes = int((ends_at - body.scheduled_at).total_seconds() // 60)
    await notify(
        session,
        user_id=other.user_id,
        kind=NotificationKind.MEETING_BOOKED,
        title=f"{display_name(viewer)} booked a meeting with you",
        body=f"{format_ist(body.scheduled_at)} IST · {minutes} min",
        action_label="View meeting",
        action_href=f"/matches/{other_match.id}/schedule",
    )
    await session.commit()
    connected_at = intro.responded_at or intro.created_at
    logger.info(
        "meeting_scheduled match_id=%s days_from_match=%d",
        match.id,
        max(0, (datetime.now(UTC) - connected_at).days),
    )
    return MeetingCreatedResponse(meeting_id=meeting_id)


async def nudge_partner(session: AsyncSession, clerk_user_id: str, match_id: UUID) -> NudgeResponse:
    """No bookable calendar on their side: share mine, or ask them to add a link."""
    viewer = await require_viewer(session, clerk_user_id)
    match = await owned_match(session, viewer, match_id)
    other = await load_other(session, match.to_profile_id)
    intro = await intro_for(session, *pair_ids(viewer, match.to_profile_id))
    if intro is None or intro.status != ConnectionStatus.ACCEPTED:
        raise _not_mutual()
    links = await _cal_links(session, viewer.profile_id, other.profile_id)
    if links.get(other.profile_id):
        raise ProblemError(
            status=409,
            slug="partner-has-link",
            title="Their calendar is available",
            detail="They've linked Cal.com. Pick a time on the scheduling page.",
        )

    name = display_name(viewer)
    if links.get(viewer.profile_id):
        other_match = await ensure_match_row(session, match, other)
        kind = NotificationKind.MEETING_INVITE
        title = f"{name} shared a booking link with you"
        body = "Pick a time on their Cal.com calendar."
        action_label, action_href = "Pick a time", f"/matches/{other_match.id}/schedule"
    else:
        kind = NotificationKind.SCHEDULING_LINK_REQUEST
        title = f"{name} wants to schedule a meeting"
        body = "Add your Cal.com booking link in Settings so they can pick a time."
        action_label, action_href = "Add booking link", "/settings/account"

    recent: UUID | None = await session.scalar(
        select(Notification.id)
        .where(
            Notification.user_id == other.user_id,
            Notification.kind == kind.value,
            Notification.title == title,
            Notification.created_at >= datetime.now(UTC) - NUDGE_COOLDOWN,
        )
        .limit(1)
    )
    if recent is not None:
        return NudgeResponse(status="already_sent")
    await notify(
        session,
        user_id=other.user_id,
        kind=kind,
        title=title,
        body=body,
        action_label=action_label,
        action_href=action_href,
    )
    await session.commit()
    return NudgeResponse(status="sent")


async def _own_profile(session: AsyncSession, clerk_user_id: str) -> Profile:
    user = await require_user(session, clerk_user_id)
    if user.role is None:  # require_user already rejects this; narrows the type
        raise ProblemError(
            status=409, slug="not-onboarded", title="Finish onboarding", detail="Finish setup."
        )
    return await get_role_profile(session, clerk_user_id, user.role)


async def get_scheduling_link(session: AsyncSession, clerk_user_id: str) -> SchedulingLinkResponse:
    profile = await _own_profile(session, clerk_user_id)
    return SchedulingLinkResponse(
        cal_link=profile.cal_link, booking_url=booking_url(profile.cal_link)
    )


async def save_scheduling_link(
    session: AsyncSession, clerk_user_id: str, body: SchedulingLinkRequest
) -> SchedulingLinkResponse:
    profile = await _own_profile(session, clerk_user_id)
    profile.cal_link = body.url
    await session.commit()
    return SchedulingLinkResponse(cal_link=body.url, booking_url=booking_url(body.url))


async def remove_scheduling_link(
    session: AsyncSession, clerk_user_id: str
) -> SchedulingLinkResponse:
    profile = await _own_profile(session, clerk_user_id)
    profile.cal_link = None
    await session.commit()
    return SchedulingLinkResponse(cal_link=None, booking_url=None)
