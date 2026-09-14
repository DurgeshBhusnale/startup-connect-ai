import re
from datetime import UTC, datetime
from typing import Annotated, Literal, Self
from uuid import UUID

from pydantic import (
    AfterValidator,
    BaseModel,
    ConfigDict,
    Field,
    StringConstraints,
    field_validator,
    model_validator,
)

from app.models.taxonomy import Geography, InvestmentStage, Sector

_CRUNCHBASE_PROFILE = re.compile(
    r"^(?:https?://)?(?:www\.)?crunchbase\.com/(person|organization)/([a-z0-9-]{2,100})/?(?:[?#].*)?$",
    re.IGNORECASE,
)


def normalize_crunchbase_url(value: str) -> str:
    match = _CRUNCHBASE_PROFILE.match(value.strip())
    if match is None:
        raise ValueError(
            "Enter a Crunchbase profile URL like https://www.crunchbase.com/person/your-name"
        )
    return f"https://www.crunchbase.com/{match.group(1).lower()}/{match.group(2).lower()}"


ThesisCheque = Annotated[int, Field(gt=0, le=2_000_000_000)]
NoGoTag = Annotated[
    str, StringConstraints(strip_whitespace=True, to_lower=True, min_length=2, max_length=60)
]
CrunchbaseUrl = Annotated[str, AfterValidator(normalize_crunchbase_url)]


class ThesisRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    sectors: list[Sector] = Field(min_length=1, max_length=len(Sector))
    stages: list[InvestmentStage] = Field(min_length=1, max_length=len(InvestmentStage))
    cheque_min: ThesisCheque
    cheque_max: ThesisCheque
    geographies: list[Geography] = Field(min_length=1, max_length=len(Geography))
    no_gos: list[NoGoTag] = Field(default_factory=list, max_length=20)

    @model_validator(mode="after")
    def normalize(self) -> Self:
        if self.cheque_min > self.cheque_max:
            raise ValueError("cheque_min must not exceed cheque_max")
        self.sectors = list(dict.fromkeys(self.sectors))
        self.stages = list(dict.fromkeys(self.stages))
        self.geographies = list(dict.fromkeys(self.geographies))
        self.no_gos = list(dict.fromkeys(self.no_gos))
        return self


class ThesisData(BaseModel):
    sectors: list[Sector]
    stages: list[InvestmentStage]
    cheque_min: int | None
    cheque_max: int | None
    geographies: list[Geography]
    no_gos: list[str]


class ThesisResponse(BaseModel):
    thesis_id: UUID


class PriorInvestmentEntry(BaseModel):
    model_config = ConfigDict(extra="forbid")

    company: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=120)]
    sector: Sector
    stage: InvestmentStage
    cheque: Annotated[int, Field(gt=0, le=100_000_000_000)] | None = None
    year: Annotated[int, Field(ge=1990)]

    @field_validator("year")
    @classmethod
    def not_in_future(cls, value: int) -> int:
        if value > datetime.now(UTC).year:
            raise ValueError("year cannot be in the future")
        return value


class PriorInvestmentItem(PriorInvestmentEntry):
    source: str


class PriorInvestmentsRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    entries: list[PriorInvestmentEntry] = Field(min_length=3, max_length=10)
    hide_cheque_amounts: bool = True
    crunchbase_url: CrunchbaseUrl | None = None


class PriorInvestmentsResponse(BaseModel):
    count: int


class InvestorProfileState(BaseModel):
    profile_id: UUID
    completed: bool
    thesis: ThesisData | None
    prior_investments: list[PriorInvestmentItem]
    hide_cheque_amounts: bool
    crunchbase_url: str | None
    prior_investments_status: Literal["added", "skipped"] | None
    banner_dismissed: bool
    bio: str | None
