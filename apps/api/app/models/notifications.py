from datetime import datetime
from enum import StrEnum
from uuid import UUID

from pydantic import BaseModel


class NotificationKind(StrEnum):
    NEW_MATCH = "new_match"
    NEW_MATCHES = "new_matches"
    INTRO_RECEIVED = "intro_received"
    MUTUAL_MATCH = "mutual_match"
    MATCH_INTEREST = "match_interest"
    MATCHING_PAUSED = "matching_paused"
    INTRO_CANCELLED = "intro_cancelled"


class NotificationItem(BaseModel):
    id: UUID
    kind: NotificationKind
    title: str
    body: str | None
    action_label: str | None
    action_href: str | None
    read: bool
    created_at: datetime


class NotificationsResponse(BaseModel):
    items: list[NotificationItem]
    unread_count: int


class NotificationSummary(BaseModel):
    unread_count: int
    pending_intros: int


class ReadResponse(BaseModel):
    unread_count: int
