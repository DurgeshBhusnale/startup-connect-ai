from typing import Annotated

from fastapi import APIRouter, Body

from app.models.mentor import (
    LinkedInVerificationRequest,
    MentorExpertiseRequest,
    MentorExpertiseResponse,
    MentorProfileState,
    ReferencesVerificationRequest,
    VerificationResponse,
)
from app.routers.dependencies import ClerkUserId, SessionDep
from app.services import mentor_profile

router = APIRouter(prefix="/v1/mentor", tags=["mentor"])


@router.get("/profile", response_model=MentorProfileState)
async def read_mentor_profile(
    session: SessionDep, clerk_user_id: ClerkUserId
) -> MentorProfileState:
    return await mentor_profile.get_mentor_state(session, clerk_user_id)


@router.post("/expertise", response_model=MentorExpertiseResponse)
async def save_expertise(
    payload: MentorExpertiseRequest, session: SessionDep, clerk_user_id: ClerkUserId
) -> MentorExpertiseResponse:
    return await mentor_profile.save_expertise(session, clerk_user_id, payload)


@router.post("/verification-request", response_model=VerificationResponse)
async def request_verification(
    payload: Annotated[
        LinkedInVerificationRequest | ReferencesVerificationRequest,
        Body(discriminator="method"),
    ],
    session: SessionDep,
    clerk_user_id: ClerkUserId,
) -> VerificationResponse:
    return await mentor_profile.request_verification(session, clerk_user_id, payload)
