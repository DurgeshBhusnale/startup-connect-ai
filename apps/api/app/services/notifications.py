from uuid import UUID

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.errors import ProblemError
from app.models.db import IntroRequest, Notification, Profile, User
from app.models.notifications import (
    NotificationItem,
    NotificationKind,
    NotificationsResponse,
    NotificationSummary,
    ReadResponse,
)

TITLE_LIMIT = 200
BODY_LIMIT = 300


def notify(
    session: AsyncSession,
    *,
    user_id: UUID,
    kind: NotificationKind,
    title: str,
    body: str | None = None,
    action_label: str | None = None,
    action_href: str | None = None,
) -> None:
    """Adds an in-app notification to the caller's transaction (email/WhatsApp come in Week 7+)."""
    session.add(
        Notification(
            user_id=user_id,
            kind=kind.value,
            title=title[:TITLE_LIMIT],
            body=body[:BODY_LIMIT] if body else None,
            action_label=action_label,
            action_href=action_href,
        )
    )


async def _user_id(session: AsyncSession, clerk_user_id: str) -> UUID | None:
    user_id: UUID | None = await session.scalar(
        select(User.id).where(User.clerk_id == clerk_user_id)
    )
    return user_id


async def _unread_count(session: AsyncSession, user_id: UUID) -> int:
    count: int | None = await session.scalar(
        select(func.count())
        .select_from(Notification)
        .where(Notification.user_id == user_id, Notification.read_at.is_(None))
    )
    return count or 0


def _item(row: Notification) -> NotificationItem:
    return NotificationItem(
        id=row.id,
        kind=NotificationKind(row.kind),
        title=row.title,
        body=row.body,
        action_label=row.action_label,
        action_href=row.action_href,
        read=row.read_at is not None,
        created_at=row.created_at,
    )


async def list_notifications(
    session: AsyncSession, clerk_user_id: str, limit: int
) -> NotificationsResponse:
    user_id = await _user_id(session, clerk_user_id)
    if user_id is None:
        return NotificationsResponse(items=[], unread_count=0)
    rows = (
        await session.scalars(
            select(Notification)
            .where(Notification.user_id == user_id)
            .order_by(Notification.created_at.desc())
            .limit(limit)
        )
    ).all()
    return NotificationsResponse(
        items=[_item(row) for row in rows], unread_count=await _unread_count(session, user_id)
    )


async def mark_read(
    session: AsyncSession, clerk_user_id: str, notification_id: UUID
) -> ReadResponse:
    user_id = await _user_id(session, clerk_user_id)
    owned: UUID | None = (
        await session.scalar(
            select(Notification.id).where(
                Notification.id == notification_id, Notification.user_id == user_id
            )
        )
        if user_id is not None
        else None
    )
    if user_id is None or owned is None:
        raise ProblemError(
            status=404,
            slug="notification-not-found",
            title="Notification not found",
            detail="This notification doesn't exist.",
        )
    await session.execute(
        update(Notification)
        .where(Notification.id == notification_id, Notification.read_at.is_(None))
        .values(read_at=func.now())
    )
    await session.commit()
    return ReadResponse(unread_count=await _unread_count(session, user_id))


async def mark_all_read(session: AsyncSession, clerk_user_id: str) -> ReadResponse:
    user_id = await _user_id(session, clerk_user_id)
    if user_id is not None:
        await session.execute(
            update(Notification)
            .where(Notification.user_id == user_id, Notification.read_at.is_(None))
            .values(read_at=func.now())
        )
        await session.commit()
    return ReadResponse(unread_count=0)


async def notification_summary(session: AsyncSession, clerk_user_id: str) -> NotificationSummary:
    user_id = await _user_id(session, clerk_user_id)
    if user_id is None:
        return NotificationSummary(unread_count=0, pending_intros=0)
    pending: int | None = await session.scalar(
        select(func.count())
        .select_from(IntroRequest)
        .join(Profile, IntroRequest.partner_profile_id == Profile.id)
        .where(Profile.user_id == user_id, IntroRequest.status == "pending")
    )
    return NotificationSummary(
        unread_count=await _unread_count(session, user_id), pending_intros=pending or 0
    )
