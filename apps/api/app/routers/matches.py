from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Query

from app.errors import ProblemError
from app.models.matches import MatchItem, RecomputeResponse
from app.routers.dependencies import ClerkUserId, SessionDep
from app.services import matching

router = APIRouter(prefix="/v1/matches", tags=["matches"])


@router.get("", response_model=list[MatchItem])
async def read_matches(
    session: SessionDep,
    clerk_user_id: ClerkUserId,
    background_tasks: BackgroundTasks,
    limit: Annotated[int, Query(ge=1, le=8)] = 8,
) -> list[MatchItem]:
    return await matching.list_matches(session, clerk_user_id, limit, background_tasks)


@router.post("/recompute", response_model=RecomputeResponse)
async def recompute_matches(session: SessionDep, clerk_user_id: ClerkUserId) -> RecomputeResponse:
    try:
        return await matching.compute_matches(session, clerk_user_id)
    except ProblemError:
        raise
    except Exception as exc:
        raise matching.unavailable_error() from exc
