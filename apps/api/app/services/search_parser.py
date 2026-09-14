"""S2: turns a plain-language search into structured filters.

The LLM reads the query; a deterministic keyword pass backs it up and covers LLM outages. Every
value is checked against the shared taxonomy, so a query can't smuggle instructions or unknown
values in.
"""

import json
import logging
import re
from dataclasses import dataclass
from typing import Literal

import openai

from app.config import get_settings
from app.models.search import RoleName, SearchFilters
from app.models.taxonomy import ExpertiseArea, Geography, InvestmentStage, Sector
from app.prompts.search import SYSTEM_PROMPT, build_user_prompt
from app.services.llm import get_llm_client

logger = logging.getLogger(__name__)

MAX_AMOUNT_INR = 100_000_000_000
KEYWORD_CHARS = 120

ROLE_ALIASES: dict[str, RoleName] = {
    **dict.fromkeys(
        ["investor", "investors", "angel", "angels", "vc", "vcs", "fund", "funds", "backers"],
        "investor",
    ),
    **dict.fromkeys(
        ["mentor", "mentors", "advisor", "advisors", "adviser", "advisers", "operators", "coach"],
        "mentor",
    ),
    **dict.fromkeys(
        ["founder", "founders", "startup", "startups", "entrepreneur", "entrepreneurs"],
        "founder",
    ),
}

SECTOR_ALIASES: dict[str, Sector] = {
    **{sector.value.lower(): sector for sector in Sector if sector != Sector.OTHER},
    "ai": Sector.AI_ML,
    "ml": Sector.AI_ML,
    "artificial intelligence": Sector.AI_ML,
    "machine learning": Sector.AI_ML,
    "fin-tech": Sector.FINTECH,
    "payments": Sector.FINTECH,
    "b2b saas": Sector.SAAS,
    "health": Sector.HEALTHTECH,
    "healthcare": Sector.HEALTHTECH,
    "education": Sector.EDTECH,
    "ecommerce": Sector.D2C,
    "e-commerce": Sector.D2C,
    "ev": Sector.MOBILITY,
    "climate": Sector.CLIMATE_ENERGY,
    "cleantech": Sector.CLIMATE_ENERGY,
    "energy": Sector.CLIMATE_ENERGY,
    "crypto": Sector.WEB3,
    "blockchain": Sector.WEB3,
    "agri": Sector.AGRITECH,
    "agriculture": Sector.AGRITECH,
    "insurance": Sector.INSURTECH,
    "security": Sector.CYBERSECURITY,
    "iot": Sector.HARDWARE_IOT,
    "hardware": Sector.HARDWARE_IOT,
    "logistics": Sector.LOGISTICS,
    "supply chain": Sector.LOGISTICS,
    "real estate": Sector.PROPTECH,
    "space": Sector.SPACETECH,
    "creators": Sector.CREATOR_ECONOMY,
    "developer tools": Sector.DEVTOOLS,
    "hr": Sector.HR_TECH,
    "media": Sector.MEDIA_CONTENT,
    "legaltech": Sector.LEGAL_TECH,
}

STAGE_ALIASES: dict[str, InvestmentStage] = {
    "pre-seed": InvestmentStage.PRE_SEED,
    "pre seed": InvestmentStage.PRE_SEED,
    "preseed": InvestmentStage.PRE_SEED,
    "seed": InvestmentStage.SEED,
    "series a": InvestmentStage.SERIES_A,
    "series-a": InvestmentStage.SERIES_A,
    "series b": InvestmentStage.SERIES_B_PLUS,
    "series-b": InvestmentStage.SERIES_B_PLUS,
    "series b+": InvestmentStage.SERIES_B_PLUS,
    "series c": InvestmentStage.SERIES_B_PLUS,
    "growth stage": InvestmentStage.SERIES_B_PLUS,
}

GEOGRAPHY_ALIASES: dict[str, Geography] = {
    "bengaluru": Geography.BENGALURU,
    "bangalore": Geography.BENGALURU,
    "blr": Geography.BENGALURU,
    "pune": Geography.PUNE,
    "mumbai": Geography.MUMBAI,
    "bombay": Geography.MUMBAI,
    "delhi": Geography.DELHI_NCR,
    "ncr": Geography.DELHI_NCR,
    "delhi ncr": Geography.DELHI_NCR,
    "gurgaon": Geography.DELHI_NCR,
    "gurugram": Geography.DELHI_NCR,
    "noida": Geography.DELHI_NCR,
    "hyderabad": Geography.HYDERABAD,
    "chennai": Geography.CHENNAI,
    "india": Geography.INDIA,
    "indian": Geography.INDIA,
    "sea": Geography.SEA,
    "southeast asia": Geography.SEA,
    "singapore": Geography.SEA,
    "us": Geography.US,
    "usa": Geography.US,
    "united states": Geography.US,
    "global": Geography.GLOBAL,
    "worldwide": Geography.GLOBAL,
}

EXPERTISE_ALIASES: dict[str, ExpertiseArea] = {
    **{area.value.lower(): area for area in ExpertiseArea},
    "go-to-market": ExpertiseArea.GTM,
    "go to market": ExpertiseArea.GTM,
    "growth": ExpertiseArea.GROWTH_LOOPS,
    "fund raising": ExpertiseArea.FUNDRAISING,
    "engineering": ExpertiseArea.ENGINEERING_LEADERSHIP,
    "legal": ExpertiseArea.LEGAL_COMPLIANCE,
    "compliance": ExpertiseArea.LEGAL_COMPLIANCE,
    "operations": ExpertiseArea.OPS,
    "product-market fit": ExpertiseArea.PMF,
    "product market fit": ExpertiseArea.PMF,
    "icp": ExpertiseArea.ICP_DEFINITION,
    "analytics": ExpertiseArea.DATA_ANALYTICS,
    "paid ads": ExpertiseArea.PAID_ACQUISITION,
    "performance marketing": ExpertiseArea.PAID_ACQUISITION,
}

_UNITS = {
    "k": 1e3,
    "thousand": 1e3,
    "l": 1e5,
    "lac": 1e5,
    "lacs": 1e5,
    "lakh": 1e5,
    "lakhs": 1e5,
    "m": 1e6,
    "mn": 1e6,
    "million": 1e6,
    "cr": 1e7,
    "crore": 1e7,
    "crores": 1e7,
}
_AMOUNT = re.compile(
    r"(\d+(?:\.\d+)?)\s*(lakhs?|lacs?|l|crores?|cr|k|thousand|mn|m|million)(?![a-z])"
)


def _find[T](text: str, aliases: dict[str, T]) -> list[T]:
    """Taxonomy values named in the text; longer phrases win ("pre-seed" before "seed")."""
    found: list[T] = []
    remaining = text
    for alias in sorted(aliases, key=len, reverse=True):
        pattern = re.compile(rf"(?<![a-z0-9]){re.escape(alias)}(?![a-z0-9+])")
        if pattern.search(remaining):
            value = aliases[alias]
            if value not in found:
                found.append(value)
            remaining = pattern.sub(" ", remaining)
    return found


def _amounts(text: str) -> tuple[int | None, int | None]:
    values = [int(float(number) * _UNITS[unit]) for number, unit in _AMOUNT.findall(text)]
    values = [value for value in values if 0 < value <= MAX_AMOUNT_INR]
    if not values:
        return None, None
    return min(values), max(values)


def keyword_filters(query: str) -> SearchFilters:
    text = " ".join(query.lower().replace("₹", " ").split())
    amount_min, amount_max = _amounts(text)
    return SearchFilters(
        roles=_find(text, ROLE_ALIASES),
        sectors=_find(text, SECTOR_ALIASES),
        stages=_find(text, STAGE_ALIASES),
        geographies=_find(text, GEOGRAPHY_ALIASES),
        expertise=_find(text, EXPERTISE_ALIASES),
        amount_min=amount_min,
        amount_max=amount_max,
    )


def _pick[T](raw: object, allowed: dict[str, T]) -> list[T]:
    if not isinstance(raw, list):
        return []
    picked: list[T] = []
    for item in raw:
        value = allowed.get(item.strip().lower()) if isinstance(item, str) else None
        if value is not None and value not in picked:
            picked.append(value)
    return picked


def _amount(raw: object) -> int | None:
    if isinstance(raw, bool) or not isinstance(raw, int | float):
        return None
    return int(raw) if 0 < raw <= MAX_AMOUNT_INR else None


def sanitize_llm_filters(raw: dict[str, object]) -> SearchFilters:
    keywords = raw.get("keywords")
    amount_min, amount_max = _amount(raw.get("amount_min_inr")), _amount(raw.get("amount_max_inr"))
    if amount_min is not None and amount_max is not None and amount_min > amount_max:
        amount_min, amount_max = amount_max, amount_min
    return SearchFilters(
        roles=_pick(raw.get("roles"), {role: role for role in ROLE_ALIASES.values()}),
        sectors=_pick(raw.get("sectors"), {sector.value.lower(): sector for sector in Sector}),
        stages=_pick(raw.get("stages"), {stage.value: stage for stage in InvestmentStage}),
        geographies=_pick(raw.get("geographies"), {geo.value: geo for geo in Geography}),
        expertise=_pick(raw.get("expertise"), {area.value.lower(): area for area in ExpertiseArea}),
        amount_min=amount_min,
        amount_max=amount_max,
        keywords=" ".join(keywords.split())[:KEYWORD_CHARS] if isinstance(keywords, str) else "",
    )


async def _llm_filters(query: str) -> SearchFilters | None:
    settings = get_settings()
    extra_body = (
        {"reasoning_effort": settings.llm_reasoning_effort}
        if settings.llm_reasoning_effort
        else None
    )
    try:
        completion = await (
            get_llm_client()
            .with_options(timeout=settings.search_timeout_seconds, max_retries=0)
            .chat.completions.create(
                model=settings.groq_model,
                temperature=0,
                response_format={"type": "json_object"},
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": build_user_prompt(query)},
                ],
                extra_body=extra_body,
            )
        )
    except openai.APIError as exc:
        logger.warning("search_parse_failed reason=%s", type(exc).__name__)
        return None
    content = completion.choices[0].message.content if completion.choices else None
    try:
        raw = json.loads(content or "")
    except json.JSONDecodeError:
        logger.warning("search_parse_failed reason=non_json")
        return None
    return sanitize_llm_filters(raw) if isinstance(raw, dict) else None


def _union[T](first: list[T], second: list[T]) -> list[T]:
    return list(dict.fromkeys([*first, *second]))


@dataclass(frozen=True)
class ParsedQuery:
    filters: SearchFilters
    source: Literal["llm", "keywords"]


async def parse_query(query: str) -> ParsedQuery:
    keywords = keyword_filters(query)
    llm = await _llm_filters(query)
    if llm is None:
        return ParsedQuery(keywords, "keywords")
    merged = SearchFilters(
        roles=_union(llm.roles, keywords.roles),
        sectors=_union(llm.sectors, keywords.sectors),
        stages=_union(llm.stages, keywords.stages),
        geographies=_union(llm.geographies, keywords.geographies),
        expertise=_union(llm.expertise, keywords.expertise),
        amount_min=llm.amount_min if llm.amount_min is not None else keywords.amount_min,
        amount_max=llm.amount_max if llm.amount_max is not None else keywords.amount_max,
        keywords=llm.keywords,
    )
    return ParsedQuery(merged, "llm")
