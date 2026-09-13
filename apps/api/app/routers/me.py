from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_session
from app.models.me import MeResponse, OnboardingRequest
from app.services import onboarding

router = APIRouter(prefix="/v1/me", tags=["me"])


def get_clerk_user_id(request: Request) -> str:
    user_id: str = request.state.user_id
    return user_id


SessionDep = Annotated[AsyncSession, Depends(get_session)]
ClerkUserId = Annotated[str, Depends(get_clerk_user_id)]


@router.get("", response_model=MeResponse)
async def read_me(session: SessionDep, clerk_user_id: ClerkUserId) -> MeResponse:
    return await onboarding.get_me(session, clerk_user_id)


@router.post("/onboarding", response_model=MeResponse)
async def complete_onboarding(
    payload: OnboardingRequest, session: SessionDep, clerk_user_id: ClerkUserId
) -> MeResponse:
    try:
        return await onboarding.complete_onboarding(session, clerk_user_id, payload)
    except onboarding.MissingEmailError as exc:
        raise HTTPException(
            status_code=422,
            detail="Add an email address to your account before continuing.",
        ) from exc
