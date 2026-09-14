from fastapi import APIRouter

from app.models.search import (
    RecentSearch,
    RecentSearchesCleared,
    RequestMatchRequest,
    RequestMatchResponse,
    SearchRequest,
    SearchResponse,
)
from app.routers.dependencies import ClerkUserId, SessionDep
from app.services import search

router = APIRouter(prefix="/v1/search", tags=["search"])


@router.post("", response_model=SearchResponse)
async def run_search(
    body: SearchRequest, session: SessionDep, clerk_user_id: ClerkUserId
) -> SearchResponse:
    return await search.search(session, clerk_user_id, body)


@router.get("/recent", response_model=list[RecentSearch])
async def read_recent_searches(
    session: SessionDep, clerk_user_id: ClerkUserId
) -> list[RecentSearch]:
    return await search.recent_searches(session, clerk_user_id)


@router.delete("/recent", response_model=RecentSearchesCleared)
async def clear_recent_searches(
    session: SessionDep, clerk_user_id: ClerkUserId
) -> RecentSearchesCleared:
    return await search.clear_recent_searches(session, clerk_user_id)


@router.post("/request-match", response_model=RequestMatchResponse)
async def request_match(
    body: RequestMatchRequest, session: SessionDep, clerk_user_id: ClerkUserId
) -> RequestMatchResponse:
    return await search.request_match(session, clerk_user_id, body)
