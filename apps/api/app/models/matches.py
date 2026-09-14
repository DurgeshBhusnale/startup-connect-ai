from typing import Literal
from uuid import UUID

from pydantic import BaseModel


class MatchProfileCard(BaseModel):
    profile_id: UUID
    kind: Literal["founder", "investor", "mentor"]
    display_name: str
    headline: str
    location: str | None
    bio: str | None
    facts: list[str]


class MatchExplanation(BaseModel):
    source: Literal["template", "llm"]
    short: str
    features_used: list[str]


class MatchItem(BaseModel):
    match_id: UUID
    to_profile: MatchProfileCard
    fit_score: float
    content_score: float
    collab_score: float
    explanation: MatchExplanation


class RecomputeResponse(BaseModel):
    count: int
