from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, File, Query, UploadFile

from app.errors import ProblemError
from app.models.posts import (
    MediaUploadResponse,
    PostCreatedResponse,
    PostCreateRequest,
    PostDeletedResponse,
    PostsPage,
    PostUpdateRequest,
)
from app.routers.dependencies import ClerkUserId, SessionDep
from app.services import posts
from app.services.media import MAX_IMAGE_BYTES

router = APIRouter(tags=["posts"])

Cursor = Annotated[str | None, Query(max_length=100)]


# /me routes are declared before /{profile_id} so "me" isn't parsed as a profile id.
@router.get("/v1/profiles/me/posts", response_model=PostsPage)
async def read_my_posts(
    session: SessionDep, clerk_user_id: ClerkUserId, cursor: Cursor = None
) -> PostsPage:
    return await posts.list_own_posts(session, clerk_user_id, cursor)


@router.post("/v1/profiles/me/posts", response_model=PostCreatedResponse, status_code=201)
async def create_post(
    body: PostCreateRequest, session: SessionDep, clerk_user_id: ClerkUserId
) -> PostCreatedResponse:
    return await posts.create_post(session, clerk_user_id, body)


@router.patch("/v1/profiles/me/posts/{post_id}", response_model=PostCreatedResponse)
async def update_post(
    post_id: UUID, body: PostUpdateRequest, session: SessionDep, clerk_user_id: ClerkUserId
) -> PostCreatedResponse:
    return await posts.update_post(session, clerk_user_id, post_id, body)


@router.delete("/v1/profiles/me/posts/{post_id}", response_model=PostDeletedResponse)
async def delete_post(
    post_id: UUID, session: SessionDep, clerk_user_id: ClerkUserId
) -> PostDeletedResponse:
    return await posts.delete_post(session, clerk_user_id, post_id)


@router.get("/v1/profiles/{profile_id}/posts", response_model=PostsPage)
async def read_profile_posts(
    profile_id: UUID, session: SessionDep, clerk_user_id: ClerkUserId, cursor: Cursor = None
) -> PostsPage:
    return await posts.list_profile_posts(session, clerk_user_id, profile_id, cursor)


@router.post("/v1/media/upload", response_model=MediaUploadResponse, status_code=201)
async def upload_media(
    session: SessionDep,
    clerk_user_id: ClerkUserId,
    file: Annotated[UploadFile, File()],
) -> MediaUploadResponse:
    data = await file.read(MAX_IMAGE_BYTES + 1)
    if len(data) > MAX_IMAGE_BYTES:
        raise ProblemError(
            status=413,
            slug="image-too-large",
            title="Image too large",
            detail="Images must be 5MB or smaller.",
        )
    return await posts.upload_media(session, clerk_user_id, data)
