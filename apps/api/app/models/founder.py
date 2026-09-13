import re
from enum import StrEnum
from typing import Annotated, Literal
from uuid import UUID

from pydantic import AfterValidator, BaseModel, ConfigDict, Field, StringConstraints

# Keep these option lists in sync with apps/web/lib/founder-profile.ts.


class FounderSector(StrEnum):
    FINTECH = "Fintech"
    SAAS = "SaaS"
    AI_ML = "AI/ML"
    CONSUMER = "Consumer"
    D2C = "D2C"
    HEALTHTECH = "Healthtech"
    EDTECH = "Edtech"
    AGRITECH = "Agritech"
    CLIMATE_ENERGY = "Climate & Energy"
    LOGISTICS = "Logistics"
    MOBILITY = "Mobility"
    DEEP_TECH = "Deep Tech"
    ENTERPRISE = "Enterprise"
    HR_TECH = "HR Tech"
    PROPTECH = "Proptech"
    GAMING = "Gaming"
    MEDIA_CONTENT = "Media & Content"
    CYBERSECURITY = "Cybersecurity"
    LEGAL_TECH = "Legal Tech"
    OTHER = "Other"


class FounderStage(StrEnum):
    PRE_SEED = "pre-seed"
    SEED = "seed"
    SERIES_A = "series-a"


class BusinessModel(StrEnum):
    B2B_SAAS = "B2B SaaS subscription"
    B2C_SUBSCRIPTION = "B2C subscription"
    MARKETPLACE = "Marketplace"
    TRANSACTION_FEES = "Transaction fees"
    D2C_ECOMMERCE = "D2C e-commerce"
    HARDWARE = "Hardware"
    ADVERTISING = "Advertising"
    SERVICES = "Services"
    OTHER = "Other"


_LINKEDIN_PROFILE = re.compile(
    r"^(?:https?://)?(?:[a-z]{2,3}\.)?(?:www\.)?linkedin\.com/in/([A-Za-z0-9_%.-]{3,100})/?(?:[?#].*)?$",
    re.IGNORECASE,
)


def normalize_linkedin_url(value: str) -> str:
    match = _LINKEDIN_PROFILE.match(value.strip())
    if match is None:
        raise ValueError("Enter a LinkedIn profile URL like https://linkedin.com/in/yourname")
    return f"https://www.linkedin.com/in/{match.group(1)}"


StartupName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=120)]
City = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=80)]
CompetitorName = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=60)
]
AskAmountInr = Annotated[int, Field(gt=0, le=100_000_000_000)]
TeamSize = Annotated[int, Field(ge=1, le=10_000)]
LinkedInUrl = Annotated[str, AfterValidator(normalize_linkedin_url)]


class FounderProfileDraft(BaseModel):
    startup_name: str | None = None
    sector: FounderSector | None = None
    stage: FounderStage | None = None
    ask_amount_inr: int | None = None
    team_size: int | None = None
    city: str | None = None
    business_model: BusinessModel | None = None
    competitors: list[str] = Field(default_factory=list)
    description: str | None = None


class FounderL1Data(BaseModel):
    model_config = ConfigDict(extra="forbid")

    startup_name: StartupName
    sector: FounderSector
    stage: FounderStage
    city: City
    business_model: BusinessModel
    ask_amount_inr: AskAmountInr
    team_size: TeamSize
    description: Annotated[
        str, StringConstraints(strip_whitespace=True, min_length=10, max_length=300)
    ]
    competitors: list[CompetitorName] = Field(default_factory=list, max_length=3)
    linkedin_url: LinkedInUrl | None = None


class AutobuildResponse(BaseModel):
    profile_draft: FounderProfileDraft
    confidence_map: dict[str, float]


class FounderDraftState(AutobuildResponse):
    deck_filename: str
    deck_pages: int
    linkedin_url: str


class FounderProfileState(BaseModel):
    profile_id: UUID
    completed: bool
    draft: FounderDraftState | None


class SaveProfileRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    kind: Literal["founder"]
    l1_data: FounderL1Data


class SaveProfileResponse(BaseModel):
    profile_id: UUID
