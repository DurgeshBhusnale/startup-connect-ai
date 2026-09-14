from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Query

from app.models.notifications import NotificationsResponse, NotificationSummary, ReadResponse
from app.routers.dependencies import ClerkUserId, SessionDep
from app.services import notifications

router = APIRouter(prefix="/v1/notifications", tags=["notifications"])


@router.get("", response_model=NotificationsResponse)
async def read_notifications(
    session: SessionDep,
    clerk_user_id: ClerkUserId,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
) -> NotificationsResponse:
    return await notifications.list_notifications(session, clerk_user_id, limit)


@router.get("/summary", response_model=NotificationSummary)
async def read_notification_summary(
    session: SessionDep, clerk_user_id: ClerkUserId
) -> NotificationSummary:
    return await notifications.notification_summary(session, clerk_user_id)


@router.post("/read-all", response_model=ReadResponse)
async def mark_all_notifications_read(
    session: SessionDep, clerk_user_id: ClerkUserId
) -> ReadResponse:
    return await notifications.mark_all_read(session, clerk_user_id)


@router.post("/{notification_id}/read", response_model=ReadResponse)
async def mark_notification_read(
    notification_id: UUID, session: SessionDep, clerk_user_id: ClerkUserId
) -> ReadResponse:
    return await notifications.mark_read(session, clerk_user_id, notification_id)
