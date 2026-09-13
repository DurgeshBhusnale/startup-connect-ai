from pathlib import PurePath
from typing import Annotated

from fastapi import APIRouter, File, Form, UploadFile

from app.errors import ProblemError
from app.models.founder import (
    AutobuildResponse,
    FounderProfileState,
    SaveProfileRequest,
    SaveProfileResponse,
    normalize_linkedin_url,
)
from app.routers.dependencies import ClerkUserId, SessionDep
from app.services import founder_profile

router = APIRouter(prefix="/v1/profiles", tags=["profiles"])

MAX_DECK_BYTES = 20 * 1024 * 1024


@router.get("/founder", response_model=FounderProfileState)
async def read_founder_profile(
    session: SessionDep, clerk_user_id: ClerkUserId
) -> FounderProfileState:
    return await founder_profile.get_founder_state(session, clerk_user_id)


@router.post("/autobuild", response_model=AutobuildResponse)
async def autobuild_profile(
    session: SessionDep,
    clerk_user_id: ClerkUserId,
    deck_file: Annotated[UploadFile, File()],
    linkedin_url: Annotated[str, Form(max_length=300)],
) -> AutobuildResponse:
    try:
        normalized_url = normalize_linkedin_url(linkedin_url)
    except ValueError as exc:
        raise ProblemError(
            status=422, slug="invalid-linkedin-url", title="Invalid LinkedIn URL", detail=str(exc)
        ) from exc

    deck_bytes = await deck_file.read(MAX_DECK_BYTES + 1)
    if len(deck_bytes) > MAX_DECK_BYTES:
        raise ProblemError(
            status=413,
            slug="deck-too-large",
            title="Deck too large",
            detail="Please compress your deck to under 20MB.",
        )

    return await founder_profile.autobuild_founder_profile(
        session,
        clerk_user_id,
        deck_bytes=deck_bytes,
        deck_filename=PurePath(deck_file.filename or "pitch-deck.pdf").name[:200],
        linkedin_url=normalized_url,
    )


@router.post("", response_model=SaveProfileResponse)
async def save_profile(
    payload: SaveProfileRequest, session: SessionDep, clerk_user_id: ClerkUserId
) -> SaveProfileResponse:
    return await founder_profile.save_founder_profile(session, clerk_user_id, payload)
