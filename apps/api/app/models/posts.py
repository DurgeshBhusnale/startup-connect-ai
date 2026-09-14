from datetime import UTC, date, datetime, timedelta
from enum import StrEnum
from typing import Annotated, Literal, Self
from uuid import UUID

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    StringConstraints,
    field_validator,
    model_validator,
)

POST_BODY_MAX = 500
MILESTONE_VALUE_MAX = 120
MILESTONE_DESCRIPTION_MAX = 250
MAX_POST_IMAGES = 4


class PostKind(StrEnum):
    TEXT = "text"
    IMAGE = "image"
    MILESTONE = "milestone"


class MilestoneType(StrEnum):
    USERS = "users"
    REVENUE = "revenue"
    HIRING = "hiring"
    FUNDING = "funding"
    LAUNCH = "launch"
    OTHER = "other"


PostBody = Annotated[str, StringConstraints(strip_whitespace=True, max_length=POST_BODY_MAX)]


class MilestoneData(BaseModel):
    model_config = ConfigDict(extra="forbid")

    type: MilestoneType
    value: Annotated[
        str, StringConstraints(strip_whitespace=True, min_length=3, max_length=MILESTONE_VALUE_MAX)
    ]
    achieved_on: date
    description: (
        Annotated[
            str, StringConstraints(strip_whitespace=True, max_length=MILESTONE_DESCRIPTION_MAX)
        ]
        | None
    ) = None

    @field_validator("achieved_on")
    @classmethod
    def plausible_date(cls, value: date) -> date:
        # One day of slack: "today" in India can be tomorrow in UTC.
        if value > datetime.now(UTC).date() + timedelta(days=1):
            raise ValueError("Milestone date can't be in the future")
        if value.year < 2000:
            raise ValueError("Milestone date looks too far in the past")
        return value

    @field_validator("description")
    @classmethod
    def blank_description_is_none(cls, value: str | None) -> str | None:
        return value or None


class PostCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    kind: PostKind
    body: PostBody = ""
    # Ids returned by POST /v1/media/upload. The bucket is private, so posts reference uploads
    # by id instead of storing (expiring) signed URLs.
    media_ids: list[UUID] = Field(default_factory=list, max_length=MAX_POST_IMAGES)
    milestone_data: MilestoneData | None = None

    @model_validator(mode="after")
    def content_matches_kind(self) -> Self:
        if len(set(self.media_ids)) != len(self.media_ids):
            raise ValueError("Each image can only be attached once")
        if self.kind == PostKind.TEXT:
            if not self.body:
                raise ValueError("Write something to post")
            if self.media_ids or self.milestone_data:
                raise ValueError("Text posts can't include images or milestone details")
        elif self.kind == PostKind.IMAGE:
            if not self.media_ids:
                raise ValueError("Add at least one image")
            if self.milestone_data:
                raise ValueError("Image posts can't include milestone details")
        else:
            if self.milestone_data is None:
                raise ValueError("Add the milestone details")
            if self.media_ids:
                raise ValueError("Milestone posts can't include images")
        return self


class PostUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    body: PostBody | None = None
    media_ids: list[UUID] | None = Field(default=None, max_length=MAX_POST_IMAGES)
    milestone_data: MilestoneData | None = None


class PostMediaItem(BaseModel):
    media_id: UUID
    url: str | None
    thumbnail_url: str | None
    width: int
    height: int


class PostItem(BaseModel):
    post_id: UUID
    kind: PostKind
    body: str
    milestone_data: MilestoneData | None
    media: list[PostMediaItem]
    created_at: datetime
    updated_at: datetime
    edited: bool


class PostsPage(BaseModel):
    items: list[PostItem]
    next_cursor: str | None


class PostCreatedResponse(BaseModel):
    post_id: UUID


class PostDeletedResponse(BaseModel):
    status: Literal["deleted"] = "deleted"


class MediaUploadResponse(PostMediaItem):
    pass
