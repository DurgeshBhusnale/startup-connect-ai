"""S2: natural-language search across the other side of the marketplace (S-21).

Ranking blends how many of the requested attributes a profile matches with the semantic similarity
of the query to the profile's embedding. Fit summaries are built from the matched attributes (each
cited to its profile field), so nothing shown is invented. Profiles stay private: people you aren't
matched with appear without a name, with "Request match".
"""

import logging
from uuid import UUID

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.errors import ProblemError
from app.models.db import AppRole, Match, SearchQuery, User
from app.models.search import (
    MatchedAttribute,
    RecentSearch,
    RecentSearchesCleared,
    RequestMatchRequest,
    RequestMatchResponse,
    SearchFilters,
    SearchRequest,
    SearchResponse,
    SearchResult,
)
from app.models.taxonomy import GEOGRAPHY_LABELS, STAGE_LABELS, Geography
from app.services import embeddings, vector_store
from app.services.connections import viewer_unavailable_error
from app.services.match_cards import profile_card
from app.services.match_scoring import city_geography, format_inr
from app.services.matching import can_match, ensure_pair_match
from app.services.profile_snapshots import (
    ProfileSnapshot,
    document_text,
    load_by_ids,
    load_candidates,
    load_viewer,
)
from app.services.search_parser import parse_query

logger = logging.getLogger(__name__)

MAX_CANDIDATES = 50
RECENT_KEPT = 10
RECENT_SHOWN = 5
SIMILARITY_FLOOR = 0.1
SIMILARITY_SPAN = 0.45
MIN_SEMANTIC_ONLY = 0.3
ATTRIBUTE_WEIGHT = 0.65
SEMANTIC_WEIGHT = 0.35
SINGLE_AMOUNT_TOLERANCE = 0.25
SNIPPET_CHARS = 200

OPPOSITE: dict[AppRole, list[AppRole]] = {
    AppRole.FOUNDER: [AppRole.INVESTOR, AppRole.MENTOR],
    AppRole.INVESTOR: [AppRole.FOUNDER],
    AppRole.MENTOR: [AppRole.FOUNDER],
}
SOURCES = {
    AppRole.FOUNDER: "founder's profile",
    AppRole.INVESTOR: "investor's thesis",
    AppRole.MENTOR: "mentor's expertise",
}
ROLE_PLURALS = {
    AppRole.FOUNDER: "Founders",
    AppRole.INVESTOR: "Investors",
    AppRole.MENTOR: "Mentors",
}
INDIAN_GEOGRAPHIES = {
    Geography.BENGALURU,
    Geography.PUNE,
    Geography.MUMBAI,
    Geography.DELHI_NCR,
    Geography.HYDERABAD,
    Geography.CHENNAI,
    Geography.INDIA,
}


def _requested_groups(filters: SearchFilters) -> set[str]:
    groups = {
        name
        for name, values in (
            ("sector", filters.sectors),
            ("stage", filters.stages),
            ("geography", filters.geographies),
            ("expertise", filters.expertise),
        )
        if values
    }
    if filters.amount_min is not None or filters.amount_max is not None:
        groups.add("amount")
    return groups


def _amount_overlaps(low: int, high: int, filters: SearchFilters) -> bool:
    if filters.amount_min is None and filters.amount_max is None:
        return False
    want_low = filters.amount_min if filters.amount_min is not None else 0
    want_high = filters.amount_max if filters.amount_max is not None else max(want_low, high)
    if want_low == want_high:
        want_low = int(want_low * (1 - SINGLE_AMOUNT_TOLERANCE))
        want_high = int(want_high * (1 + SINGLE_AMOUNT_TOLERANCE))
    return low <= want_high and high >= want_low


def _matched(
    candidate: ProfileSnapshot, filters: SearchFilters
) -> tuple[list[MatchedAttribute], set[str]]:
    attributes: list[MatchedAttribute] = []
    groups: set[str] = set()
    source = SOURCES[candidate.kind]

    def add(group: str, label: str, values: list[str]) -> None:
        if values:
            attributes.append(MatchedAttribute(label=label, value=", ".join(values), source=source))
            groups.add(group)

    if candidate.founder is not None:
        founder = candidate.founder
        add("sector", "Sector", [founder.sector.value] if founder.sector in filters.sectors else [])
        stage_hit = founder.stage.value in {stage.value for stage in filters.stages}
        add("stage", "Stage", [STAGE_LABELS[founder.stage.value]] if stage_hit else [])
        geography = city_geography(founder.city)
        geo_hit = geography is not None and (
            geography in filters.geographies
            or (Geography.INDIA in filters.geographies and geography in INDIAN_GEOGRAPHIES)
        )
        add("geography", "City", [founder.city] if geo_hit else [])
        ask = founder.ask_amount_inr
        add("amount", "Raising", [format_inr(ask)] if _amount_overlaps(ask, ask, filters) else [])
    elif candidate.thesis is not None:
        thesis = candidate.thesis
        add("sector", "Invests in", [s.value for s in thesis.sectors if s in filters.sectors])
        wanted_stages = {stage.value for stage in filters.stages}
        add(
            "stage",
            "Stages",
            [STAGE_LABELS[s.value] for s in thesis.stages if s.value in wanted_stages],
        )
        add(
            "geography",
            "Geographies",
            [GEOGRAPHY_LABELS[g] for g in thesis.geographies if g in filters.geographies],
        )
        if thesis.cheque_min is not None and thesis.cheque_max is not None:
            overlap = _amount_overlaps(thesis.cheque_min, thesis.cheque_max, filters)
            cheque = f"{format_inr(thesis.cheque_min)} to {format_inr(thesis.cheque_max)}"
            add("amount", "Cheque range", [cheque] if overlap else [])
    elif candidate.expertise is not None:
        expertise = candidate.expertise
        add("expertise", "Expertise", [a.value for a in expertise.areas if a in filters.expertise])
        wanted_stages = {stage.value for stage in filters.stages}
        add(
            "stage",
            "Stage focus",
            [STAGE_LABELS[s.value] for s in expertise.stages if s.value in wanted_stages],
        )
    return attributes, groups


async def _similarities(query: str, candidates: list[ProfileSnapshot]) -> dict[UUID, float] | None:
    """None when the vector store or model is down: rank on attributes only (S2 edge case)."""
    try:
        ids = [candidate.profile_id for candidate in candidates]
        versions = await vector_store.embedded_versions(ids)
        stale = [c for c in candidates if versions.get(c.profile_id) != c.embedding_v]
        if stale:
            vectors = await embeddings.embed_texts([document_text(item) for item in stale])
            await vector_store.upsert_vectors(
                [
                    (
                        item.profile_id,
                        vector,
                        {"kind": item.kind.value, "embedding_v": item.embedding_v},
                    )
                    for item, vector in zip(stale, vectors, strict=True)
                ]
            )
        [query_vector] = await embeddings.embed_texts([query])
        return await vector_store.similarities_to_vector(query_vector, ids)
    except Exception:  # any Qdrant or model failure degrades to attribute-only ranking
        logger.warning("Search similarity unavailable; ranking on attributes only", exc_info=True)
        return None


def _anonymous_headline(candidate: ProfileSnapshot) -> str:
    founder = candidate.founder
    if founder is not None:
        return f"{founder.sector.value} founder · {STAGE_LABELS[founder.stage.value]}"
    if candidate.thesis is not None:
        return f"Investor · {' & '.join(s.value for s in candidate.thesis.sectors[:2])}"
    areas = candidate.expertise.areas[:2] if candidate.expertise is not None else []
    return f"Mentor · {' & '.join(area.value for area in areas)}"


def _fit_summary(attributes: list[MatchedAttribute]) -> str:
    if not attributes:
        return "Related to your search through their profile description."
    parts = [f"{item.label.lower()} ({item.value})" for item in attributes[:3]]
    return f"Matches your search on {', '.join(parts)}."


def _result(
    viewer: ProfileSnapshot,
    candidate: ProfileSnapshot,
    attributes: list[MatchedAttribute],
    match: Match | None,
) -> SearchResult:
    card = profile_card(candidate)
    if match is not None:
        return SearchResult(
            profile_id=candidate.profile_id,
            kind=card.kind,
            match_id=match.id,
            fit_score=match.fit_score,
            display_name=card.display_name,
            headline=card.headline,
            location=card.location,
            snippet=(card.bio or "")[:SNIPPET_CHARS],
            fit_summary=_fit_summary(attributes),
            matched_attributes=attributes,
            connect="view",
        )
    location = candidate.founder.city if candidate.founder is not None else None
    return SearchResult(
        profile_id=candidate.profile_id,
        kind=card.kind,
        match_id=None,
        fit_score=None,
        display_name=None,
        headline=_anonymous_headline(candidate),
        location=location,
        snippet="",
        fit_summary=_fit_summary(attributes),
        matched_attributes=attributes,
        connect="request" if can_match(viewer, candidate) else "unavailable",
    )


def _interpretation(
    filters: SearchFilters, wanted: list[AppRole], allowed: list[AppRole]
) -> list[str]:
    chips = [ROLE_PLURALS[role] for role in wanted] if len(wanted) < len(allowed) else []
    chips += [sector.value for sector in filters.sectors]
    chips += [STAGE_LABELS[stage.value] for stage in filters.stages]
    chips += [GEOGRAPHY_LABELS[geography] for geography in filters.geographies]
    chips += [area.value for area in filters.expertise]
    low, high = filters.amount_min, filters.amount_max
    if low is not None and high is not None:
        chips.append(format_inr(low) if low == high else f"{format_inr(low)} to {format_inr(high)}")
    elif low is not None or high is not None:
        chips.append(format_inr(low or high or 0))
    return chips


async def _remember(session: AsyncSession, user_id: UUID, query: str, result_count: int) -> None:
    await session.execute(
        delete(SearchQuery).where(
            SearchQuery.user_id == user_id, func.lower(SearchQuery.query) == query.lower()
        )
    )
    session.add(SearchQuery(user_id=user_id, query=query, result_count=result_count))
    await session.flush()
    kept = (
        select(SearchQuery.id)
        .where(SearchQuery.user_id == user_id)
        .order_by(SearchQuery.created_at.desc())
        .limit(RECENT_KEPT)
    )
    await session.execute(
        delete(SearchQuery).where(SearchQuery.user_id == user_id, SearchQuery.id.not_in(kept))
    )


async def search(session: AsyncSession, clerk_user_id: str, body: SearchRequest) -> SearchResponse:
    viewer = await load_viewer(session, clerk_user_id)
    if viewer is None:
        raise await viewer_unavailable_error(session, clerk_user_id)

    parsed = await parse_query(body.query)
    filters = parsed.filters
    allowed = OPPOSITE[viewer.kind]
    wanted = [role for role in allowed if role.value in filters.roles] or allowed
    candidates = await load_candidates(session, wanted, viewer.user_id)
    requested = _requested_groups(filters)
    similarities = await _similarities(body.query, candidates) if candidates else {}

    scored: list[tuple[float, ProfileSnapshot, list[MatchedAttribute]]] = []
    for candidate in candidates:
        attributes, hit = _matched(candidate, filters)
        similarity = similarities.get(candidate.profile_id) if similarities is not None else None
        semantic = (
            min(1.0, max(0.0, (similarity - SIMILARITY_FLOOR) / SIMILARITY_SPAN))
            if similarity is not None
            else None
        )
        if requested:
            if not hit:
                continue
            ratio = len(hit & requested) / len(requested)
            score = (
                ratio if semantic is None else ATTRIBUTE_WEIGHT * ratio + SEMANTIC_WEIGHT * semantic
            )
        else:
            if semantic is None or semantic < MIN_SEMANTIC_ONLY:
                continue
            score = semantic
        scored.append((score, candidate, attributes))
    scored.sort(key=lambda item: item[0], reverse=True)
    ranked = scored[:MAX_CANDIDATES]
    page = ranked[body.offset : body.offset + body.limit]

    matches: dict[UUID, Match] = {}
    if page:
        matches = {
            row.to_profile_id: row
            for row in await session.scalars(
                select(Match).where(
                    Match.from_profile_id == viewer.profile_id,
                    Match.to_profile_id.in_([candidate.profile_id for _, candidate, _ in page]),
                )
            )
        }
    items = [
        _result(viewer, candidate, attributes, matches.get(candidate.profile_id))
        for _, candidate, attributes in page
    ]
    if body.offset == 0:
        await _remember(session, viewer.user_id, body.query, len(ranked))
        await session.commit()
    logger.info(
        "search_query_submitted query_length=%d results=%d source=%s semantic=%s",
        len(body.query),
        len(ranked),
        parsed.source,
        similarities is not None,
    )
    end = body.offset + body.limit
    return SearchResponse(
        query=body.query,
        interpreted=_interpretation(filters, wanted, allowed),
        items=items,
        total=len(ranked),
        next_offset=end if end < len(ranked) else None,
        understood_by=parsed.source,
        semantic=similarities is not None,
    )


async def recent_searches(session: AsyncSession, clerk_user_id: str) -> list[RecentSearch]:
    rows = await session.execute(
        select(SearchQuery.query, SearchQuery.created_at)
        .join(User, SearchQuery.user_id == User.id)
        .where(User.clerk_id == clerk_user_id)
        .order_by(SearchQuery.created_at.desc())
        .limit(RECENT_SHOWN)
    )
    return [
        RecentSearch(query=query, searched_at=created_at) for query, created_at in rows.tuples()
    ]


async def clear_recent_searches(session: AsyncSession, clerk_user_id: str) -> RecentSearchesCleared:
    user_id = select(User.id).where(User.clerk_id == clerk_user_id).scalar_subquery()
    await session.execute(delete(SearchQuery).where(SearchQuery.user_id == user_id))
    await session.commit()
    return RecentSearchesCleared(status="cleared")


async def request_match(
    session: AsyncSession, clerk_user_id: str, body: RequestMatchRequest
) -> RequestMatchResponse:
    viewer = await load_viewer(session, clerk_user_id)
    if viewer is None:
        raise await viewer_unavailable_error(session, clerk_user_id)
    candidate = (await load_by_ids(session, [body.profile_id])).get(body.profile_id)
    if candidate is None or candidate.kind not in OPPOSITE[viewer.kind] or not candidate.matchable:
        raise ProblemError(
            status=404,
            slug="profile-not-found",
            title="Profile not found",
            detail="This profile is no longer available.",
        )
    match_id = await ensure_pair_match(session, viewer, candidate)
    if match_id is None:
        raise ProblemError(
            status=409,
            slug="no-overlap",
            title="Not a match yet",
            detail="Your sector or stage doesn't overlap with this profile, so we can't match you.",
        )
    logger.info("search_match_requested kind=%s", candidate.kind.value)
    return RequestMatchResponse(match_id=match_id)
