from uuid import UUID

from fastapi import APIRouter

from app.models.endorsements import (
    EndorsementCreatedResponse,
    EndorsementCreateRequest,
    EndorsementRevokedResponse,
    GivenEndorsement,
    ProfileEndorsements,
)
from app.routers.dependencies import ClerkUserId, SessionDep
from app.services import endorsements

router = APIRouter(tags=["endorsements"])


@router.post("/v1/endorsements", response_model=EndorsementCreatedResponse, status_code=201)
async def create_endorsement(
    body: EndorsementCreateRequest, session: SessionDep, clerk_user_id: ClerkUserId
) -> EndorsementCreatedResponse:
    return await endorsements.create_endorsement(session, clerk_user_id, body)


@router.delete("/v1/endorsements/{endorsement_id}", response_model=EndorsementRevokedResponse)
async def revoke_endorsement(
    endorsement_id: UUID, session: SessionDep, clerk_user_id: ClerkUserId
) -> EndorsementRevokedResponse:
    return await endorsements.revoke_endorsement(session, clerk_user_id, endorsement_id)


@router.get("/v1/profiles/{profile_id}/endorsements", response_model=ProfileEndorsements)
async def read_profile_endorsements(
    profile_id: UUID, session: SessionDep, clerk_user_id: ClerkUserId
) -> ProfileEndorsements:
    return await endorsements.profile_endorsements(session, clerk_user_id, profile_id)


@router.get("/v1/me/endorsements", response_model=list[GivenEndorsement])
async def read_given_endorsements(
    session: SessionDep, clerk_user_id: ClerkUserId
) -> list[GivenEndorsement]:
    return await endorsements.given_endorsements(session, clerk_user_id)
