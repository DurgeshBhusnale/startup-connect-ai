"""S6: one text thread per mutual match, stored in Postgres and pushed over WebSocket."""

import logging
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from uuid import UUID

from sqlalchemy import ColumnElement, and_, func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.errors import ProblemError
from app.models.db import AppRole, IntroRequest, Match, Message, Notification
from app.models.feedback import ConnectionStatus
from app.models.matches import MatchProfileCard
from app.models.messages import (
    MessageCreatedResponse,
    MessageCreateRequest,
    MessageItem,
    MessagesReadResponse,
    ThreadItem,
    ThreadLastMessage,
    ThreadsResponse,
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
from app.services.profile_snapshots import ProfileSnapshot, load_by_ids
from app.services.realtime import hub

logger = logging.getLogger(__name__)

SEND_LIMIT = 20
SEND_WINDOW = timedelta(minutes=1)
PREVIEW_CHARS = 120


@dataclass
class _Thread:
    viewer: ProfileSnapshot
    match: Match
    other: ProfileSnapshot
    founder_id: UUID
    partner_id: UUID
    intro: IntroRequest | None

    @property
    def mutual(self) -> bool:
        return self.intro is not None and self.intro.status == ConnectionStatus.ACCEPTED


def message_item(row: Message, viewer_profile_id: UUID) -> MessageItem:
    return MessageItem(
        id=row.id,
        sender_id=row.sender_profile_id,
        body=row.body,
        created_at=row.created_at,
        sender_is_me=row.sender_profile_id == viewer_profile_id,
        read_at=row.read_at,
        client_ref=row.client_ref,
    )


def _in_pair(founder_id: UUID, partner_id: UUID) -> ColumnElement[bool]:
    return and_(Message.founder_profile_id == founder_id, Message.partner_profile_id == partner_id)


def _preview(body: str) -> str:
    line = " ".join(body.split())
    return line if len(line) <= PREVIEW_CHARS else f"{line[: PREVIEW_CHARS - 1].rstrip()}…"


def _closed(has_history: bool) -> ProblemError:
    return ProblemError(
        status=403,
        slug="conversation-closed",
        title="Conversation closed",
        detail=(
            "This conversation is read-only because you're no longer a mutual match."
            if has_history
            else "You can message each other once you're a mutual match."
        ),
    )


async def _open_thread(session: AsyncSession, clerk_user_id: str, match_id: UUID) -> _Thread:
    viewer = await require_viewer(session, clerk_user_id)
    match = await owned_match(session, viewer, match_id)
    other = await load_other(session, match.to_profile_id)
    founder_id, partner_id = pair_ids(viewer, match.to_profile_id)
    intro = await intro_for(session, founder_id, partner_id)
    return _Thread(viewer, match, other, founder_id, partner_id, intro)


async def _latest(session: AsyncSession, thread: _Thread) -> Message | None:
    latest: Message | None = await session.scalar(
        select(Message)
        .where(_in_pair(thread.founder_id, thread.partner_id))
        .order_by(Message.created_at.desc(), Message.id.desc())
        .limit(1)
    )
    return latest


async def unread_total(session: AsyncSession, profile_id: UUID) -> int:
    count: int | None = await session.scalar(
        select(func.count())
        .select_from(Message)
        .where(Message.recipient_profile_id == profile_id, Message.read_at.is_(None))
    )
    return count or 0


def _thread_item(
    match: Match,
    card: MatchProfileCard,
    *,
    can_send: bool,
    unread: int,
    last: Message | None,
    viewer_profile_id: UUID,
    activity: datetime,
) -> ThreadItem:
    return ThreadItem(
        match_id=match.id,
        partner=card,
        fit_score=match.fit_score,
        can_send=can_send,
        unread_count=unread,
        last_message=(
            ThreadLastMessage(
                body=_preview(last.body),
                created_at=last.created_at,
                sender_is_me=last.sender_profile_id == viewer_profile_id,
            )
            if last is not None
            else None
        ),
        last_activity_at=activity,
    )


async def list_threads(session: AsyncSession, clerk_user_id: str) -> ThreadsResponse:
    viewer = await require_viewer(session, clerk_user_id)
    me = viewer.profile_id
    is_founder = viewer.kind == AppRole.FOUNDER
    my_side = IntroRequest.founder_profile_id if is_founder else IntroRequest.partner_profile_id
    their_side = IntroRequest.partner_profile_id if is_founder else IntroRequest.founder_profile_id

    activity: dict[UUID, datetime] = {}
    mutual: set[UUID] = set()
    accepted = await session.execute(
        select(their_side, IntroRequest.responded_at, IntroRequest.created_at).where(
            my_side == me, IntroRequest.status == ConnectionStatus.ACCEPTED.value
        )
    )
    for other_id, responded_at, created_at in accepted.tuples():
        mutual.add(other_id)
        activity[other_id] = responded_at or created_at

    latest_rows = (
        await session.scalars(
            select(Message)
            .where(or_(Message.founder_profile_id == me, Message.partner_profile_id == me))
            .distinct(Message.founder_profile_id, Message.partner_profile_id)
            .order_by(
                Message.founder_profile_id,
                Message.partner_profile_id,
                Message.created_at.desc(),
                Message.id.desc(),
            )
        )
    ).all()
    latest: dict[UUID, Message] = {}
    for row in latest_rows:
        other_id = (
            row.partner_profile_id if row.founder_profile_id == me else row.founder_profile_id
        )
        latest[other_id] = row
        activity[other_id] = row.created_at

    if not activity:
        return ThreadsResponse(items=[], unread_total=0)

    unread_rows = await session.execute(
        select(Message.sender_profile_id, func.count())
        .where(Message.recipient_profile_id == me, Message.read_at.is_(None))
        .group_by(Message.sender_profile_id)
    )
    unread: dict[UUID, int] = dict(unread_rows.tuples().all())
    matches = {
        row.to_profile_id: row
        for row in await session.scalars(
            select(Match).where(Match.from_profile_id == me, Match.to_profile_id.in_(activity))
        )
    }
    # Deleted or paused accounts drop out of the list, like everywhere else they're invisible.
    people = await load_by_ids(session, list(activity))

    items: list[ThreadItem] = []
    for other_id, last_activity in activity.items():
        match, person = matches.get(other_id), people.get(other_id)
        if match is None or person is None:
            continue
        items.append(
            _thread_item(
                match,
                profile_card(person),
                can_send=other_id in mutual,
                unread=unread.get(other_id, 0),
                last=latest.get(other_id),
                viewer_profile_id=me,
                activity=last_activity,
            )
        )
    items.sort(key=lambda item: item.last_activity_at, reverse=True)
    return ThreadsResponse(items=items, unread_total=sum(item.unread_count for item in items))


async def get_thread(session: AsyncSession, clerk_user_id: str, match_id: UUID) -> ThreadItem:
    thread = await _open_thread(session, clerk_user_id, match_id)
    last = await _latest(session, thread)
    if not thread.mutual and last is None:
        raise _closed(has_history=False)
    unread: int | None = await session.scalar(
        select(func.count())
        .select_from(Message)
        .where(
            _in_pair(thread.founder_id, thread.partner_id),
            Message.recipient_profile_id == thread.viewer.profile_id,
            Message.read_at.is_(None),
        )
    )
    intro = thread.intro
    fallback = (intro.responded_at or intro.created_at) if intro else thread.match.created_at
    return _thread_item(
        thread.match,
        profile_card(thread.other),
        can_send=thread.mutual,
        unread=unread or 0,
        last=last,
        viewer_profile_id=thread.viewer.profile_id,
        activity=last.created_at if last else fallback,
    )


async def list_messages(
    session: AsyncSession,
    clerk_user_id: str,
    match_id: UUID,
    *,
    limit: int,
    before: datetime | None,
) -> list[MessageItem]:
    """The `limit` messages before `before` (default: the newest), oldest first."""
    thread = await _open_thread(session, clerk_user_id, match_id)
    if not thread.mutual and await _latest(session, thread) is None:
        raise _closed(has_history=False)
    query = select(Message).where(_in_pair(thread.founder_id, thread.partner_id))
    if before is not None:
        query = query.where(Message.created_at < before)
    rows = (
        await session.scalars(
            query.order_by(Message.created_at.desc(), Message.id.desc()).limit(limit)
        )
    ).all()
    return [message_item(row, thread.viewer.profile_id) for row in reversed(rows)]


async def send_message(
    session: AsyncSession, clerk_user_id: str, match_id: UUID, body: MessageCreateRequest
) -> MessageCreatedResponse:
    thread = await _open_thread(session, clerk_user_id, match_id)
    viewer, other = thread.viewer, thread.other

    if body.client_ref is not None:
        existing: Message | None = await session.scalar(
            select(Message).where(
                Message.sender_profile_id == viewer.profile_id,
                Message.client_ref == body.client_ref,
            )
        )
        if existing is not None:
            item = message_item(existing, viewer.profile_id)
            return MessageCreatedResponse(message_id=item.id, message=item)

    if not thread.mutual:
        raise _closed(has_history=await _latest(session, thread) is not None)

    now = datetime.now(UTC)
    recent: int | None = await session.scalar(
        select(func.count())
        .select_from(Message)
        .where(
            Message.sender_profile_id == viewer.profile_id,
            Message.created_at >= now - SEND_WINDOW,
        )
    )
    if (recent or 0) >= SEND_LIMIT:
        raise ProblemError(
            status=429,
            slug="slow-down",
            title="Slow down",
            detail="You're sending messages too quickly. Wait a moment and try again.",
        )

    row = Message(
        founder_profile_id=thread.founder_id,
        partner_profile_id=thread.partner_id,
        sender_profile_id=viewer.profile_id,
        recipient_profile_id=other.profile_id,
        body=body.body,
        client_ref=body.client_ref,
        created_at=now,
    )
    session.add(row)
    await session.flush()
    other_match = await ensure_match_row(session, thread.match, other)
    other_match_id, my_match_id = other_match.id, thread.match.id

    # One unread "new message" notification per conversation, however many messages arrive.
    href = f"/messages/{other_match_id}"
    waiting: UUID | None = await session.scalar(
        select(Notification.id)
        .where(
            Notification.user_id == other.user_id,
            Notification.kind == NotificationKind.MESSAGE_RECEIVED.value,
            Notification.action_href == href,
            Notification.read_at.is_(None),
        )
        .limit(1)
    )
    if waiting is None:
        await notify(
            session,
            user_id=other.user_id,
            kind=NotificationKind.MESSAGE_RECEIVED,
            title=f"New message from {display_name(viewer)}",
            body=_preview(body.body),
            action_label="Reply",
            action_href=href,
        )
    mine, theirs = message_item(row, viewer.profile_id), message_item(row, other.profile_id)
    await session.commit()

    await hub.publish(
        other.profile_id,
        {
            "type": "message.created",
            "match_id": str(other_match_id),
            "message": theirs.model_dump(mode="json"),
            "unread_total": await unread_total(session, other.profile_id),
        },
    )
    # The sender's other tabs and devices.
    await hub.publish(
        viewer.profile_id,
        {
            "type": "message.created",
            "match_id": str(my_match_id),
            "message": mine.model_dump(mode="json"),
        },
    )
    logger.info("message_sent match_id=%s char_count=%d", my_match_id, len(body.body))
    return MessageCreatedResponse(message_id=mine.id, message=mine)


async def mark_thread_read(
    session: AsyncSession, clerk_user_id: str, match_id: UUID
) -> MessagesReadResponse:
    viewer = await require_viewer(session, clerk_user_id)
    match = await owned_match(session, viewer, match_id)
    founder_id, partner_id = pair_ids(viewer, match.to_profile_id)
    now = datetime.now(UTC)
    marked = (
        await session.scalars(
            update(Message)
            .where(
                _in_pair(founder_id, partner_id),
                Message.recipient_profile_id == viewer.profile_id,
                Message.read_at.is_(None),
            )
            .values(read_at=now)
            .returning(Message.id)
            .execution_options(synchronize_session=False)
        )
    ).all()
    await session.execute(
        update(Notification)
        .where(
            Notification.user_id == viewer.user_id,
            Notification.kind == NotificationKind.MESSAGE_RECEIVED.value,
            Notification.action_href == f"/messages/{match.id}",
            Notification.read_at.is_(None),
        )
        .values(read_at=now)
        .execution_options(synchronize_session=False)
    )
    other_match_id: UUID | None = None
    if marked:
        other_match_id = await session.scalar(
            select(Match.id).where(
                Match.from_profile_id == match.to_profile_id,
                Match.to_profile_id == viewer.profile_id,
            )
        )
    await session.commit()

    if other_match_id is not None:
        await hub.publish(
            match.to_profile_id,
            {"type": "message.read", "match_id": str(other_match_id), "read_at": now.isoformat()},
        )
    logger.info("message_thread_opened match_id=%s unread_count=%d", match.id, len(marked))
    return MessagesReadResponse(
        marked=len(marked), unread_total=await unread_total(session, viewer.profile_id)
    )
