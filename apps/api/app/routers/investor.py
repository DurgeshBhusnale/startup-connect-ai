from fastapi import APIRouter

from app.models.investor import (
    InvestorProfileState,
    PriorInvestmentsRequest,
    PriorInvestmentsResponse,
    ThesisRequest,
    ThesisResponse,
)
from app.routers.dependencies import ClerkUserId, SessionDep
from app.services import investor_profile

router = APIRouter(prefix="/v1/investor", tags=["investor"])


@router.get("/profile", response_model=InvestorProfileState)
async def read_investor_profile(
    session: SessionDep, clerk_user_id: ClerkUserId
) -> InvestorProfileState:
    return await investor_profile.get_investor_state(session, clerk_user_id)


@router.post("/thesis", response_model=ThesisResponse)
async def save_thesis(
    payload: ThesisRequest, session: SessionDep, clerk_user_id: ClerkUserId
) -> ThesisResponse:
    return await investor_profile.save_thesis(session, clerk_user_id, payload)


@router.post("/prior-investments", response_model=PriorInvestmentsResponse)
async def save_prior_investments(
    payload: PriorInvestmentsRequest, session: SessionDep, clerk_user_id: ClerkUserId
) -> PriorInvestmentsResponse:
    return await investor_profile.save_prior_investments(session, clerk_user_id, payload)


@router.post("/prior-investments/skip", response_model=PriorInvestmentsResponse)
async def skip_prior_investments(
    session: SessionDep, clerk_user_id: ClerkUserId
) -> PriorInvestmentsResponse:
    return await investor_profile.skip_prior_investments(session, clerk_user_id)


@router.post("/onboarding-banner/dismiss", status_code=204)
async def dismiss_onboarding_banner(session: SessionDep, clerk_user_id: ClerkUserId) -> None:
    await investor_profile.dismiss_prior_investments_banner(session, clerk_user_id)
