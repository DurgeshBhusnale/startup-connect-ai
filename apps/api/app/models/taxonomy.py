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
