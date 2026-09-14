from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Query

from app.errors import ProblemError
from app.models.feedback import (
    IntroCreatedResponse,
    IntroDraftRequest,
    IntroDraftResponse,
    IntroRequestBody,
    MatchActionRequest,
    MatchActionResponse,
)
from app.models.matches import (
    ExplanationResponse,
    MatchDetailResponse,
    MatchItem,
    RecomputeResponse,
    SavedMatchItem,
)
from app.routers.dependencies import ClerkUserId, SessionDep
from app.services import connections, intro_draft, matching

router = APIRouter(prefix="/v1/matches", tags=["matches"])


@router.get("", response_model=list[MatchItem])
async def read_matches(
    session: SessionDep,
    clerk_user_id: ClerkUserId,
    background_tasks: BackgroundTasks,
    limit: Annotated[int, Query(ge=1, le=8)] = 8,
) -> list[MatchItem]:
    return await matching.list_matches(session, clerk_user_id, limit, background_tasks)


# Declared before /{match_id} so "saved" isn't parsed as a match id.
@router.get("/saved", response_model=list[SavedMatchItem])
async def read_saved_matches(
    session: SessionDep, clerk_user_id: ClerkUserId, background_tasks: BackgroundTasks
) -> list[SavedMatchItem]:
    return await matching.list_saved_matches(session, clerk_user_id, background_tasks)


@router.post("/recompute", response_model=RecomputeResponse)
async def recompute_matches(
    session: SessionDep, clerk_user_id: ClerkUserId, background_tasks: BackgroundTasks
) -> RecomputeResponse:
    try:
        result = await matching.compute_matches(session, clerk_user_id)
    except ProblemError:
        raise
    except Exception as exc:
        raise matching.unavailable_error() from exc
    background_tasks.add_task(matching.explain_in_background, clerk_user_id)
    return result


@router.get("/{match_id}", response_model=MatchDetailResponse)
async def read_match_detail(
    match_id: UUID, session: SessionDep, clerk_user_id: ClerkUserId
) -> MatchDetailResponse:
    return await matching.get_match_detail(session, clerk_user_id, match_id)


@router.get("/{match_id}/explanation", response_model=ExplanationResponse)
async def read_match_explanation(
    match_id: UUID, session: SessionDep, clerk_user_id: ClerkUserId
) -> ExplanationResponse:
    return await matching.get_match_explanation(session, clerk_user_id, match_id)


@router.post("/{match_id}/action", response_model=MatchActionResponse)
async def take_match_action(
    match_id: UUID, body: MatchActionRequest, session: SessionDep, clerk_user_id: ClerkUserId
) -> MatchActionResponse:
    return await connections.apply_match_action(session, clerk_user_id, match_id, body)


@router.post("/{match_id}/draft-intro", response_model=IntroDraftResponse)
async def draft_intro_message(
    match_id: UUID, body: IntroDraftRequest, session: SessionDep, clerk_user_id: ClerkUserId
) -> IntroDraftResponse:
    return await intro_draft.draft_intro(session, clerk_user_id, match_id, body)


@router.post("/{match_id}/intro", response_model=IntroCreatedResponse, status_code=201)
async def request_intro(
    match_id: UUID, body: IntroRequestBody, session: SessionDep, clerk_user_id: ClerkUserId
) -> IntroCreatedResponse:
    return await connections.request_intro(session, clerk_user_id, match_id, body)
