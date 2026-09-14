from datetime import datetime
from typing import Annotated, Literal
from uuid import UUID

from pydantic import BaseModel, Field

from app.models.feedback import MatchState
from app.models.founder import FounderL1Data
from app.models.investor import PriorInvestmentItem, ThesisData
from app.models.mentor import MentorExpertiseData
from app.models.profile import BadgesResponse

CitationSource = Literal[
    "founder_profile", "investor_thesis", "investor_portfolio", "mentor_expertise"
]
ExplanationSource = Literal["template", "llm"]


class MatchProfileCard(BaseModel):
    profile_id: UUID
    kind: Literal["founder", "investor", "mentor"]
    display_name: str
    headline: str
    location: str | None
    bio: str | None
    facts: list[str]


# Stored shapes (matches.features / matches.explanation JSONB).
class StoredCitation(BaseModel):
    value: str
    source: CitationSource


class FeatureDetail(BaseModel):
    label: str
    score: float
    weight: float
    reason: str
    concern: str | None = None
    citations: list[StoredCitation] = Field(default_factory=list)


class Citation(BaseModel):
    value: str
    sources: list[CitationSource]


class ExplanationFull(BaseModel):
    positives: list[str]
    concerns: list[str]


class StoredExplanation(BaseModel):
    source: ExplanationSource
    short: str
    full: ExplanationFull
    features_used: list[str]
    citations: list[Citation]
    features_hash: str
    generated_at: datetime
    llm_failed_at: datetime | None = None


# API shapes.
class MatchExplanation(BaseModel):
    source: ExplanationSource
    short: str
    features_used: list[str]


class ExplanationResponse(MatchExplanation):
    match_id: UUID
    full: ExplanationFull
    citations: list[Citation]
    generated_at: datetime


class MatchItem(BaseModel):
    match_id: UUID
    to_profile: MatchProfileCard
    fit_score: float
    content_score: float
    collab_score: float
    explanation: MatchExplanation
    state: MatchState


class SavedMatchItem(MatchItem):
    saved_at: datetime


class MeetingItem(BaseModel):
    meeting_id: UUID
    scheduled_at: datetime
    ends_at: datetime
    duration_minutes: int
    title: str | None
    video_url: str | None
    status: Literal["scheduled", "cancelled"]
    host_is_me: bool
    booked_by_me: bool


class FeatureScore(BaseModel):
    feature: str
    label: str
    score: float
    weight: float


class FounderMatchDetails(BaseModel):
    kind: Literal["founder"] = "founder"
    l1: FounderL1Data
    website: str | None


class InvestorMatchDetails(BaseModel):
    kind: Literal["investor"] = "investor"
    thesis: ThesisData
    prior_investments: list[PriorInvestmentItem]
    cheques_hidden: bool


class MentorMatchDetails(BaseModel):
    kind: Literal["mentor"] = "mentor"
    expertise: MentorExpertiseData


MatchDetails = Annotated[
    FounderMatchDetails | InvestorMatchDetails | MentorMatchDetails, Field(discriminator="kind")
]


class MatchDetailResponse(BaseModel):
    match_id: UUID
    fit_score: float
    content_score: float
    collab_score: float
    updated_at: datetime
    to_profile: MatchProfileCard
    details: MatchDetails
    scoring: list[FeatureScore]
    badges: BadgesResponse
    state: MatchState
    upcoming_meeting: MeetingItem | None = None


class RecomputeResponse(BaseModel):
    count: int
