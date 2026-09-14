from datetime import datetime
from typing import Annotated, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, StringConstraints

from app.models.taxonomy import ExpertiseArea, Geography, InvestmentStage, Sector

SEARCH_QUERY_MAX = 200
RoleName = Literal["founder", "investor", "mentor"]


class SearchRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    query: Annotated[
        str, StringConstraints(strip_whitespace=True, min_length=2, max_length=SEARCH_QUERY_MAX)
    ]
    limit: Annotated[int, Field(ge=1, le=10)] = 8
    # Ranking keeps the best 50 candidates (S2 edge case); pages are taken by offset.
    offset: Annotated[int, Field(ge=0, le=45)] = 0


class SearchFilters(BaseModel):
    """What the query asks for, restricted to the shared taxonomy."""

    roles: list[RoleName] = Field(default_factory=list)
    sectors: list[Sector] = Field(default_factory=list)
    stages: list[InvestmentStage] = Field(default_factory=list)
    geographies: list[Geography] = Field(default_factory=list)
    expertise: list[ExpertiseArea] = Field(default_factory=list)
    # Rupees: a cheque size or a fundraise. A single amount sets both ends.
    amount_min: int | None = None
    amount_max: int | None = None
    keywords: str = ""


class MatchedAttribute(BaseModel):
    label: str
    value: str
    # Where the value comes from, e.g. "investor's thesis" (S2 AC2 citation).
    source: str


class SearchResult(BaseModel):
    profile_id: UUID
    kind: RoleName
    # The viewer's own match row, when one exists.
    match_id: UUID | None
    fit_score: float | None
    # Hidden until the pair is matched: profiles stay private (M10 AC7).
    display_name: str | None
    headline: str
    location: str | None
    snippet: str
    fit_summary: str
    matched_attributes: list[MatchedAttribute]
    # view: open Match Detail · request: create the match · unavailable: no sector/stage overlap.
    connect: Literal["view", "request", "unavailable"]


class SearchResponse(BaseModel):
    query: str
    # Chips describing how the query was understood, e.g. ["Investors", "Fintech", "Pune"].
    interpreted: list[str]
    items: list[SearchResult]
    total: int
    next_offset: int | None
    understood_by: Literal["llm", "keywords"]
    semantic: bool


class RecentSearch(BaseModel):
    query: str
    searched_at: datetime


class RecentSearchesCleared(BaseModel):
    status: Literal["cleared"]


class RequestMatchRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    profile_id: UUID


class RequestMatchResponse(BaseModel):
    match_id: UUID
