from enum import StrEnum

# Shared by founders and investors so matching compares like with like.
# Keep in sync with apps/web/lib/taxonomy.ts.


class Sector(StrEnum):
    FINTECH = "Fintech"
    SAAS = "SaaS"
    AI_ML = "AI/ML"
    DEEP_TECH = "Deep Tech"
    ENTERPRISE = "Enterprise"
    CONSUMER = "Consumer"
    HEALTHTECH = "Healthtech"
    EDTECH = "Edtech"
    D2C = "D2C"
    MOBILITY = "Mobility"
    CLIMATE_ENERGY = "Climate & Energy"
    WEB3 = "Web3"
    AGRITECH = "Agritech"
    INSURTECH = "Insurtech"
    B2B_COMMERCE = "B2B Commerce"
    CYBERSECURITY = "Cybersecurity"
    BIOTECH = "BioTech"
    HARDWARE_IOT = "Hardware / IoT"
    GAMING = "Gaming"
    LOGISTICS = "Logistics & Supply Chain"
    PROPTECH = "Proptech"
    SPACETECH = "SpaceTech"
    CREATOR_ECONOMY = "Creator Economy"
    DEVTOOLS = "DevTools"
    HR_TECH = "HR Tech"
    MEDIA_CONTENT = "Media & Content"
    LEGAL_TECH = "Legal Tech"
    OTHER = "Other"


class FounderStage(StrEnum):
    PRE_SEED = "pre-seed"
    SEED = "seed"
    SERIES_A = "series-a"


class InvestmentStage(StrEnum):
    PRE_SEED = "pre-seed"
    SEED = "seed"
    SERIES_A = "series-a"
    SERIES_B_PLUS = "series-b-plus"


class Geography(StrEnum):
    BENGALURU = "bengaluru"
    PUNE = "pune"
    MUMBAI = "mumbai"
    DELHI_NCR = "delhi-ncr"
    HYDERABAD = "hyderabad"
    CHENNAI = "chennai"
    INDIA = "india"
    SEA = "sea"
    US = "us"
    GLOBAL = "global"


class ExpertiseArea(StrEnum):
    GTM = "GTM"
    PRODUCT = "Product"
    HIRING = "Hiring"
    FUNDRAISING = "Fundraising"
    ENGINEERING_LEADERSHIP = "Engineering leadership"
    DESIGN = "Design"
    LEGAL_COMPLIANCE = "Legal / compliance"
    OPS = "Ops"
    PMF = "PMF"
    ICP_DEFINITION = "ICP definition"
    SALES = "Sales"
    MARKETING = "Marketing"
    COMMUNITY = "Community"
    CONTENT = "Content"
    DATA_ANALYTICS = "Data / analytics"
    GROWTH_LOOPS = "Growth loops"
    PRICING = "Pricing"
    ENTERPRISE_SALES = "Enterprise sales"
    SEO = "SEO"
    PAID_ACQUISITION = "Paid acquisition"


class MentorAvailability(StrEnum):
    ONE_PER_MONTH = "1-per-month"
    TWO_PER_MONTH = "2-per-month"
    FOUR_PER_MONTH = "4-per-month"
    UNLIMITED = "unlimited"


STAGE_LABELS: dict[str, str] = {
    "pre-seed": "Pre-seed",
    "seed": "Seed",
    "series-a": "Series A",
    "series-b-plus": "Series B+",
}

GEOGRAPHY_LABELS: dict[Geography, str] = {
    Geography.BENGALURU: "Bengaluru",
    Geography.PUNE: "Pune",
    Geography.MUMBAI: "Mumbai",
    Geography.DELHI_NCR: "Delhi NCR",
    Geography.HYDERABAD: "Hyderabad",
    Geography.CHENNAI: "Chennai",
    Geography.INDIA: "India",
    Geography.SEA: "SEA",
    Geography.US: "US",
    Geography.GLOBAL: "Global",
}

AVAILABILITY_LABELS: dict[MentorAvailability, str] = {
    MentorAvailability.ONE_PER_MONTH: "1 session / month",
    MentorAvailability.TWO_PER_MONTH: "2 sessions / month",
    MentorAvailability.FOUR_PER_MONTH: "4 sessions / month",
    MentorAvailability.UNLIMITED: "Open availability",
}
