from fastapi import APIRouter, HTTPException

from app.models.me import MeResponse, OnboardingRequest
from app.routers.dependencies import ClerkUserId, SessionDep
from app.services import onboarding

router = APIRouter(prefix="/v1/me", tags=["me"])


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
