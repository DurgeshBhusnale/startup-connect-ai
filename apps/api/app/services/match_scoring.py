from dataclasses import dataclass

from app.models.founder import FounderL1Data
from app.models.investor import ThesisData
from app.models.mentor import MentorExpertiseData
from app.models.taxonomy import STAGE_LABELS, Geography

# MiniLM cosine similarities for related profiles typically land in 0.15-0.65; stretch that to 0-1.
SEMANTIC_FLOOR = 0.15
SEMANTIC_CEILING = 0.65
NEUTRAL_SEMANTIC = 0.5
STRONG_SIGNAL = 0.7

CITY_ALIASES: dict[Geography, tuple[str, ...]] = {
    Geography.BENGALURU: ("bengaluru", "bangalore"),
    Geography.PUNE: ("pune",),
    Geography.MUMBAI: ("mumbai", "thane"),
    Geography.DELHI_NCR: ("delhi", "gurgaon", "gurugram", "noida", "ncr", "faridabad", "ghaziabad"),
    Geography.HYDERABAD: ("hyderabad", "secunderabad"),
    Geography.CHENNAI: ("chennai",),
}


@dataclass(frozen=True)
class Feature:
    name: str
    score: float
    weight: float
    reason: str


@dataclass(frozen=True)
class ContentScore:
    score: float
    features: list[Feature]
    semantic_available: bool

    def template_explanation(self) -> dict[str, object]:
        """M8 AC4 fallback explanation; LLM-written explanations replace it in M8."""
        strongest = sorted(
            (feature for feature in self.features if feature.score >= STRONG_SIGNAL),
            key=lambda feature: feature.score * feature.weight,
            reverse=True,
        )[:3]
        return {
            "source": "template",
            "short": " · ".join(feature.reason for feature in strongest)
            or "Partial fit on your stated criteria",
            "features_used": [feature.name for feature in strongest],
        }

    def breakdown(self) -> dict[str, dict[str, float]]:
        return {
            feature.name: {"score": round(feature.score, 3), "weight": feature.weight}
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
        return [Feature("semantic", NEUTRAL_SEMANTIC, weight, "Semantic similarity unavailable")]
    score = min(1.0, max(0.0, (similarity - SEMANTIC_FLOOR) / (SEMANTIC_CEILING - SEMANTIC_FLOOR)))
    return [Feature("semantic", score, weight, "Closely related focus in both profiles")]


def _combine(features: list[Feature], semantic_available: bool) -> ContentScore:
    total_weight = sum(feature.weight for feature in features)
    score = (
        sum(feature.score * feature.weight for feature in features) / total_weight
        if total_weight
        else 0.0
    )
    return ContentScore(round(score, 4), features, semantic_available)


def score_founder_investor(
    founder: FounderL1Data, thesis: ThesisData, similarity: float | None
) -> ContentScore:
    stage_label = STAGE_LABELS[founder.stage.value]
    stage_match = founder.stage.value in {stage.value for stage in thesis.stages}
    stage_reason = (
        f"Stage match ({stage_label})" if stage_match else f"{stage_label} is outside their stages"
    )
    features = [
        Feature(
            "sector",
            1.0 if founder.sector in thesis.sectors else 0.0,
            0.25,
            f"Sector match ({founder.sector.value})",
        ),
        Feature(
            "stage",
            1.0 if stage_match else 0.0,
            0.20,
            stage_reason,
        ),
    ]

    ask = format_inr(founder.ask_amount_inr)
    if thesis.cheque_min is None or thesis.cheque_max is None:
        features.append(Feature("cheque", 0.5, 0.20, "Cheque range not set"))
    else:
        low, high = format_inr(thesis.cheque_min), format_inr(thesis.cheque_max)
        if thesis.cheque_min <= founder.ask_amount_inr <= thesis.cheque_max:
            features.append(
                Feature("cheque", 1.0, 0.20, f"Ask {ask} within {low} to {high} cheque range")
            )
        elif founder.ask_amount_inr > thesis.cheque_max:
            features.append(
                Feature("cheque", 0.7, 0.20, f"Can take part of a {ask} round (up to {high})")
            )
        else:
            features.append(
                Feature("cheque", 0.2, 0.20, f"Ask {ask} is below their {low} minimum cheque")
            )

    geographies = set(thesis.geographies)
    founder_geo = city_geography(founder.city)
    if founder_geo is not None and founder_geo in geographies:
        features.append(Feature("geography", 1.0, 0.15, f"Based in {founder.city}, a focus city"))
    elif Geography.INDIA in geographies:
        features.append(Feature("geography", 0.8, 0.15, "Invests across India"))
    elif Geography.GLOBAL in geographies:
        features.append(Feature("geography", 0.8, 0.15, "Invests globally"))
    else:
        features.append(
            Feature("geography", 0.0, 0.15, f"{founder.city} is outside their focus regions")
        )

    return _combine(features + _semantic(similarity, 0.20), similarity is not None)


def score_founder_mentor(
    founder: FounderL1Data, expertise: MentorExpertiseData, similarity: float | None
) -> ContentScore:
    stage_label = STAGE_LABELS[founder.stage.value]
    stage_match = founder.stage.value in {stage.value for stage in expertise.stages}
    features = [
        Feature(
            "stage",
            1.0 if stage_match else 0.0,
            0.60,
            f"Mentors {stage_label}-stage founders",
        )
    ]
    # Founders don't state mentoring needs yet, so semantic similarity only orders stage matches.
    return _combine(features + _semantic(similarity, 0.40), similarity is not None)
