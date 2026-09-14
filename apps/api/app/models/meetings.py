import re
from datetime import UTC, datetime, timedelta
from enum import StrEnum
from typing import Annotated, Literal, Self
from urllib.parse import urlsplit
from uuid import UUID

from pydantic import (
    AwareDatetime,
    BaseModel,
    ConfigDict,
    StringConstraints,
    field_validator,
    model_validator,
)

from app.models.feedback import ConnectionStatus
from app.models.matches import MatchProfileCard, MeetingItem

CAL_LINK_PATTERN = re.compile(r"^[A-Za-z0-9_.-]{1,64}(/[A-Za-z0-9_.-]{1,64})?$")
CAL_HOSTS = frozenset({"cal.com", "www.cal.com"})
DEFAULT_MEETING_LENGTH = timedelta(minutes=30)
MAX_MEETING_LENGTH = timedelta(hours=8)
INVALID_CAL_LINK = "Use your Cal.com booking link, like cal.com/yourname/30min."


class SchedulingLinkRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    # Accepts "https://cal.com/riya/intro", "cal.com/riya", or "riya/intro"; stored as the path.
    url: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=300)]

    @field_validator("url")
    @classmethod
    def to_cal_link(cls, value: str) -> str:
        candidate = value
        if "://" not in candidate:
            lowered = candidate.lower()
            if lowered.startswith(("cal.com/", "www.cal.com/")):
                candidate = f"https://{candidate}"
            else:
                candidate = f"https://cal.com/{candidate.lstrip('/')}"
        parts = urlsplit(candidate)
        if (
            parts.scheme != "https"
            or (parts.hostname or "").lower() not in CAL_HOSTS
            or parts.query
            or parts.fragment
        ):
            raise ValueError(INVALID_CAL_LINK)
        path = parts.path.strip("/")
        if not CAL_LINK_PATTERN.match(path):
            raise ValueError(INVALID_CAL_LINK)
        return path


class SchedulingLinkResponse(BaseModel):
    cal_link: str | None
    booking_url: str | None


class SchedulingContext(BaseModel):
    match_id: UUID
    connection: ConnectionStatus
    can_schedule: bool
    partner: MatchProfileCard
    # Only revealed once the pair is a mutual match.
    partner_cal_link: str | None
    my_cal_link: str | None
    host: Literal["partner", "me"] | None
    upcoming_meeting: MeetingItem | None


class MeetingCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    match_id: UUID
    scheduled_at: AwareDatetime
    ends_at: AwareDatetime | None = None
    cal_event_id: Annotated[
        str,
        StringConstraints(
            strip_whitespace=True, min_length=1, max_length=200, pattern=r"^[A-Za-z0-9_-]+$"
        ),
    ]
    host: Literal["partner", "me"]
    title: Annotated[str, StringConstraints(strip_whitespace=True, max_length=200)] | None = None
    video_url: Annotated[str, StringConstraints(strip_whitespace=True, max_length=500)] | None = (
        None
    )

    @model_validator(mode="after")
    def plausible_booking(self) -> Self:
        now = datetime.now(UTC)
        if self.scheduled_at < now - timedelta(hours=1):
            raise ValueError("That meeting time is in the past")
        if self.scheduled_at > now + timedelta(days=366):
            raise ValueError("That meeting time is too far ahead")
        ends_at = self.ends_at or self.scheduled_at + DEFAULT_MEETING_LENGTH
        if not timedelta(0) < ends_at - self.scheduled_at <= MAX_MEETING_LENGTH:
            raise ValueError("That meeting length doesn't look right")
        self.ends_at = ends_at
        if self.video_url and not self.video_url.startswith("https://"):
            self.video_url = None
        return self


class MeetingCreatedResponse(BaseModel):
    meeting_id: UUID


class NudgeResponse(BaseModel):
    status: Literal["sent", "already_sent"]


class OutcomeChoice(StrEnum):
    GREAT_FIT = "great_fit"
    NOT_A_FIT = "not_a_fit"
    UNDECIDED = "undecided"
    # The meeting didn't happen: doesn't count against either party.
    CANCELLED = "cancelled"


class MeetingOutcomeRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    outcome: OutcomeChoice
    notes: Annotated[str, StringConstraints(strip_whitespace=True, max_length=500)] | None = None

    @field_validator("notes")
    @classmethod
    def blank_is_none(cls, value: str | None) -> str | None:
        return value or None


class MeetingOutcomeResponse(BaseModel):
    status: Literal["saved"]
    outcome: OutcomeChoice


class MeetingOutcomeContext(BaseModel):
    meeting: MeetingItem
    # The viewer's own match row, for "Back to match"; None if it has since been removed.
    match_id: UUID | None
    partner: MatchProfileCard
    can_submit: bool
    my_outcome: OutcomeChoice | None
    my_notes: str | None
    submitted_at: datetime | None
