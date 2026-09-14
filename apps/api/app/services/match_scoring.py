from collections.abc import Sequence
from dataclasses import dataclass

from app.models.founder import FounderL1Data
from app.models.investor import ThesisData
from app.models.matches import CitationSource
from app.models.mentor import MentorExpertiseData
from app.models.taxonomy import GEOGRAPHY_LABELS, STAGE_LABELS, Geography

# MiniLM cosine similarities for related profiles typically land in 0.15-0.65; stretch that to 0-1.
SEMANTIC_FLOOR = 0.15
SEMANTIC_CEILING = 0.65
NEUTRAL_SEMANTIC = 0.5
STRONG_SIGNAL = 0.7
# An ask in the top 20% of a cheque range is flagged as a consideration (M8 AC3).
HIGH_END_OF_RANGE = 0.8

CITY_ALIASES: dict[Geography, tuple[str, ...]] = {
    Geography.BENGALURU: ("bengaluru", "bangalore"),
    Geography.PUNE: ("pune",),
    Geography.MUMBAI: ("mumbai", "thane"),
    Geography.DELHI_NCR: ("delhi", "gurgaon", "gurugram", "noida", "ncr", "faridabad", "ghaziabad"),
    Geography.HYDERABAD: ("hyderabad", "secunderabad"),
    Geography.CHENNAI: ("chennai",),
}


@dataclass(frozen=True)
class PriorDeal:
    company: str
    sector: str
    stage: str


@dataclass(frozen=True)
class Citation:
    value: str
    source: CitationSource


@dataclass(frozen=True)
class Feature:
    """One scoring signal. Reasons and concerns are role-neutral: both sides read them."""

    name: str
    label: str
    score: float
    weight: float
    reason: str
    concern: str | None = None
    citations: tuple[Citation, ...] = ()


@dataclass(frozen=True)
class ContentScore:
    score: float
    features: list[Feature]
    semantic_available: bool

    def breakdown(self) -> dict[str, dict[str, object]]:
        return {
            feature.name: {
                "label": feature.label,
                "score": round(feature.score, 3),
                "weight": feature.weight,
                "reason": feature.reason,
                "concern": feature.concern,
                "citations": [
                    {"value": citation.value, "source": citation.source}
                    for citation in feature.citations
                ],
            }
            for feature in self.features
        }


def format_inr(rupees: int) -> str:
    for size, suffix in ((10_000_000, "Cr"), (100_000, "L")):
        if rupees >= size:
            return f"₹{rupees / size:.2f}".rstrip("0").rstrip(".") + suffix
    return f"₹{rupees:,}"


def city_geography(city: str) -> Geography | None:
    normalized = city.strip().lower()
    return next(
        (
            geo
            for geo, aliases in CITY_ALIASES.items()
            if any(alias in normalized for alias in aliases)
        ),
        None,
    )


def investor_filter(founder: FounderL1Data, thesis: ThesisData) -> bool:
    if founder.sector not in thesis.sectors:
        return False
    blocked = {tag.lower() for tag in thesis.no_gos}
    return founder.sector.value.lower() not in blocked


def mentor_filter(founder: FounderL1Data, expertise: MentorExpertiseData) -> bool:
    # Founders don't state mentoring needs yet, so stage focus is the basic filter.
    return founder.stage.value in {stage.value for stage in expertise.stages}


def _semantic(similarity: float | None, weight: float) -> list[Feature]:
    if similarity is None:
        # Degraded mode: a neutral score keeps fits comparable instead of inflating structured ones.
        return [
            Feature(
                "semantic", "Profile similarity", NEUTRAL_SEMANTIC, weight, "Similarity unavailable"
            )
        ]
    score = min(1.0, max(0.0, (similarity - SEMANTIC_FLOOR) / (SEMANTIC_CEILING - SEMANTIC_FLOOR)))
    reason = (
        "Closely related focus in both profiles"
        if score >= STRONG_SIGNAL
        else "Some overlap in how both profiles describe their focus"
    )
    return [Feature("semantic", "Profile similarity", score, weight, reason)]


def _combine(features: list[Feature], semantic_available: bool) -> ContentScore:
    total_weight = sum(feature.weight for feature in features)
    score = (
        sum(feature.score * feature.weight for feature in features) / total_weight
        if total_weight
        else 0.0
    )
    return ContentScore(round(score, 4), features, semantic_available)


def _cheque_feature(founder: FounderL1Data, thesis: ThesisData) -> Feature:
    ask = format_inr(founder.ask_amount_inr)
    ask_citation = Citation(ask, "founder_profile")
    if thesis.cheque_min is None or thesis.cheque_max is None:
        return Feature(
            "cheque", "Cheque range", 0.5, 0.20, "Cheque range not set", citations=(ask_citation,)
        )

    low, high = format_inr(thesis.cheque_min), format_inr(thesis.cheque_max)
    citations = (ask_citation, Citation(low, "investor_thesis"), Citation(high, "investor_thesis"))
    if founder.ask_amount_inr > thesis.cheque_max:
        message = f"Ask {ask} is above the {high} maximum cheque, so it would be a partial cheque"
        return Feature(
            "cheque", "Cheque range", 0.6, 0.20, message, concern=message, citations=citations
        )
    if founder.ask_amount_inr < thesis.cheque_min:
        message = f"Ask {ask} is below the {low} minimum cheque"
        return Feature(
            "cheque", "Cheque range", 0.2, 0.20, message, concern=message, citations=citations
        )

    span = thesis.cheque_max - thesis.cheque_min
    high_end = span > 0 and founder.ask_amount_inr > thesis.cheque_min + HIGH_END_OF_RANGE * span
    return Feature(
        "cheque",
        "Cheque range",
        1.0,
        0.20,
        f"Ask {ask} is within the {low} to {high} cheque range",
        concern=f"Ask {ask} is at the high end of the {low} to {high} range" if high_end else None,
        citations=citations,
    )


def _geography_feature(founder: FounderL1Data, thesis: ThesisData) -> Feature:
    city_citation = Citation(founder.city, "founder_profile")
    geographies = set(thesis.geographies)
    founder_geo = city_geography(founder.city)
    if founder_geo is not None and founder_geo in geographies:
        return Feature(
            "geography",
            "Geographic overlap",
            1.0,
            0.15,
            f"{founder.city} is a focus city in the thesis",
            citations=(city_citation, Citation(GEOGRAPHY_LABELS[founder_geo], "investor_thesis")),
        )
    for broad, reason in ((Geography.INDIA, "India-wide"), (Geography.GLOBAL, "global")):
        if broad in geographies:
            return Feature(
                "geography",
                "Geographic overlap",
                0.8,
                0.15,
                f"The thesis is {reason}, which covers {founder.city}",
                citations=(city_citation, Citation(GEOGRAPHY_LABELS[broad], "investor_thesis")),
            )

    regions = ", ".join(GEOGRAPHY_LABELS[geo] for geo in thesis.geographies)
    message = f"{founder.city} is outside the thesis focus regions ({regions})"
    return Feature(
        "geography",
        "Geographic overlap",
        0.0,
        0.15,
        message,
        concern=message,
        citations=(
            city_citation,
            *(Citation(GEOGRAPHY_LABELS[geo], "investor_thesis") for geo in thesis.geographies),
        ),
    )


def _portfolio_feature(founder: FounderL1Data, deals: Sequence[PriorDeal]) -> Feature | None:
    # Investors who skipped prior investments get no portfolio signal rather than a penalty.
    if not deals:
        return None
    sector = founder.sector.value
    in_sector = [deal for deal in deals if deal.sector == sector]
    if not in_sector:
        message = f"None of the {len(deals)} listed prior investments are in {sector}"
        return Feature(
            "portfolio",
            "Portfolio fit",
            0.0,
            0.10,
            message,
            concern=message,
            citations=(Citation(sector, "founder_profile"),),
        )

    named = in_sector[:3]
    noun = "investment" if len(in_sector) == 1 else "investments"
    return Feature(
        "portfolio",
        "Portfolio fit",
        min(1.0, len(in_sector) / 2),
        0.10,
        f"{len(in_sector)} prior {sector} {noun}, including {', '.join(d.company for d in named)}",
        citations=(
            Citation(sector, "founder_profile"),
            *(Citation(deal.company, "investor_portfolio") for deal in named),
        ),
    )


def score_founder_investor(
    founder: FounderL1Data,
    thesis: ThesisData,
    deals: Sequence[PriorDeal],
    similarity: float | None,
) -> ContentScore:
    sector = founder.sector.value
    stage_label = STAGE_LABELS[founder.stage.value]
    stage_match = founder.stage.value in {stage.value for stage in thesis.stages}
    thesis_stages = ", ".join(STAGE_LABELS[stage.value] for stage in thesis.stages)
    stage_message = f"{stage_label} stage is outside the thesis stages ({thesis_stages})"
    features = [
        Feature(
            "sector",
            "Sector match",
            1.0 if founder.sector in thesis.sectors else 0.0,
            0.25,
            f"Sector match ({sector})",
            citations=(Citation(sector, "founder_profile"), Citation(sector, "investor_thesis")),
        ),
        Feature(
            "stage",
            "Stage match",
            1.0 if stage_match else 0.0,
            0.20,
            f"Stage match ({stage_label})" if stage_match else stage_message,
            concern=None if stage_match else stage_message,
            citations=(
                Citation(stage_label, "founder_profile"),
                *(
                    Citation(STAGE_LABELS[stage.value], "investor_thesis")
                    for stage in thesis.stages
                ),
            ),
        ),
        _cheque_feature(founder, thesis),
        _geography_feature(founder, thesis),
    ]
    portfolio = _portfolio_feature(founder, deals)
    if portfolio is not None:
        features.append(portfolio)
    return _combine([*features, *_semantic(similarity, 0.20)], similarity is not None)


def score_founder_mentor(
    founder: FounderL1Data, expertise: MentorExpertiseData, similarity: float | None
) -> ContentScore:
    stage_label = STAGE_LABELS[founder.stage.value]
    stage_match = founder.stage.value in {stage.value for stage in expertise.stages}
    outside = f"{stage_label} stage is outside the mentoring focus"
    features = [
        Feature(
            "stage",
            "Stage focus",
            1.0 if stage_match else 0.0,
            0.60,
            f"{stage_label} stage is in the mentoring focus" if stage_match else outside,
            concern=None if stage_match else outside,
            citations=(
                Citation(stage_label, "founder_profile"),
                *(
                    Citation(STAGE_LABELS[stage.value], "mentor_expertise")
                    for stage in expertise.stages
                ),
            ),
        )
    ]
    # Founders don't state mentoring needs yet, so semantic similarity only orders stage matches.
    return _combine([*features, *_semantic(similarity, 0.40)], similarity is not None)
