"""M4: founder-authored L3 posts (text, image, milestone) with moderation and private images."""

import asyncio
import logging
from collections.abc import Sequence
from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid4

from pydantic import ValidationError
from sqlalchemy import delete, exists, func, literal, or_, select, tuple_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased

from app.errors import ProblemError, UpstreamServiceError
from app.models.db import AppRole, Match, Post, PostMedia, Profile, User
from app.models.posts import (
    MediaUploadResponse,
    MilestoneData,
    PostCreatedResponse,
    PostCreateRequest,
    PostDeletedResponse,
    PostItem,
    PostKind,
    PostMediaItem,
    PostsPage,
    PostUpdateRequest,
)
from app.services import storage
from app.services.media import InvalidImageError, process_image
from app.services.moderation import ModerationVerdict, moderate_text
from app.services.profile_lookup import get_role_profile

logger = logging.getLogger(__name__)

PAGE_SIZE = 20
MAX_UPLOADS_PER_HOUR = 40
ORPHAN_MEDIA_TTL = timedelta(hours=24)
DELETE_GRACE_PERIOD = timedelta(days=30)
EDITED_AFTER = timedelta(minutes=1)


def _problem(status: int, slug: str, title: str, detail: str) -> ProblemError:
    return ProblemError(status=status, slug=slug, title=title, detail=detail)


def _post_not_found() -> ProblemError:
    return _problem(404, "post-not-found", "Post not found", "This post no longer exists.")


def _moderation_text(body: str, milestone: MilestoneData | None) -> str:
    parts = [body]
    if milestone is not None:
        parts.extend([milestone.value, milestone.description or ""])
    return "\n".join(part for part in parts if part)


async def _moderate(kind: PostKind, text: str) -> ModerationVerdict:
    verdict = await moderate_text(text)
    if verdict.outcome == "blocked":
        logger.info("post_moderation_blocked kind=%s reason=%s", kind.value, verdict.category)
        raise _problem(
            422,
            "post-blocked",
            "Post blocked",
            "This content can't be posted. Please review our community guidelines.",
        )
    return verdict


def _review_status(kind: PostKind, verdict: ModerationVerdict) -> tuple[str, str | None]:
    # Fail open (PRD M4 edge case): publish, but keep the post flagged for a later review pass.
    if verdict.outcome == "unavailable":
        return "pending_review", "moderation_unavailable"
    if kind == PostKind.IMAGE:
        return "pending_review", "images_not_scanned"
    return "approved", None


def _validated(
    kind: PostKind, body: str, media_ids: list[UUID], milestone: MilestoneData | None
) -> PostCreateRequest:
    try:
        return PostCreateRequest(
            kind=kind, body=body, media_ids=media_ids, milestone_data=milestone
        )
    except ValidationError as exc:
        message = exc.errors()[0].get("msg", "Check the post and try again.")
        raise _problem(
            422, "invalid-post", "Invalid post", str(message).removeprefix("Value error, ")
        ) from exc


async def _claim_media(
    session: AsyncSession, profile_id: UUID, media_ids: list[UUID], post_id: UUID | None
) -> list[PostMedia]:
    if not media_ids:
        return []
    rows = (
        await session.scalars(
            select(PostMedia).where(PostMedia.id.in_(media_ids), PostMedia.profile_id == profile_id)
        )
    ).all()
    by_id = {row.id: row for row in rows}
    if len(by_id) != len(media_ids) or any(
        row.post_id is not None and row.post_id != post_id for row in rows
    ):
        raise _problem(
            422,
            "invalid-media",
            "Image not found",
            "One of the images is missing. Upload it again.",
        )
    return [by_id[media_id] for media_id in media_ids]


async def create_post(
    session: AsyncSession, clerk_user_id: str, body: PostCreateRequest
) -> PostCreatedResponse:
    # Moderate before touching the database so no pooled connection waits on the LLM call.
    verdict = await _moderate(body.kind, _moderation_text(body.body, body.milestone_data))
    profile = await get_role_profile(session, clerk_user_id, AppRole.FOUNDER)
    media = await _claim_media(session, profile.id, body.media_ids, None)
    status, note = _review_status(body.kind, verdict)
    post = Post(
        profile_id=profile.id,
        kind=body.kind.value,
        body=body.body,
        milestone=body.milestone_data.model_dump(mode="json") if body.milestone_data else None,
        moderation_status=status,
        moderation_note=note,
    )
    session.add(post)
    await session.flush()
    post_id = post.id
    for position, item in enumerate(media):
        item.post_id, item.position = post_id, position
    # PRD M4 AC5: the profile embedding picks up the new post on the next match computation.
    profile.embedding_v += 1
    await session.commit()
    logger.info(
        "post_created kind=%s has_media=%s char_count=%d",
        body.kind.value,
        bool(media),
        len(body.body),
    )
    return PostCreatedResponse(post_id=post_id)


async def _own_post(session: AsyncSession, profile_id: UUID, post_id: UUID) -> Post:
    post: Post | None = await session.scalar(
        select(Post).where(
            Post.id == post_id, Post.profile_id == profile_id, Post.deleted_at.is_(None)
        )
    )
    if post is None:
        raise _post_not_found()
    return post


async def update_post(
    session: AsyncSession, clerk_user_id: str, post_id: UUID, body: PostUpdateRequest
) -> PostCreatedResponse:
    profile = await get_role_profile(session, clerk_user_id, AppRole.FOUNDER)
    post = await _own_post(session, profile.id, post_id)
    kind = PostKind(post.kind)
    current_media = (
        await session.scalars(
            select(PostMedia).where(PostMedia.post_id == post.id).order_by(PostMedia.position)
        )
    ).all()
    stored_milestone = MilestoneData.model_validate(post.milestone) if post.milestone else None
    candidate = _validated(
        kind,
        body.body if body.body is not None else post.body,
        body.media_ids if body.media_ids is not None else [row.id for row in current_media],
        body.milestone_data if body.milestone_data is not None else stored_milestone,
    )
    # Release the connection before the moderation call (PRD M4 AC8: edits are re-moderated).
    await session.commit()
    verdict = await _moderate(kind, _moderation_text(candidate.body, candidate.milestone_data))

    media = await _claim_media(session, profile.id, candidate.media_ids, post.id)
    kept = {row.id for row in media}
    removed = [row for row in current_media if row.id not in kept]
    removed_paths = [path for row in removed for path in (row.storage_path, row.thumbnail_path)]
    if removed:
        await session.execute(
            delete(PostMedia).where(PostMedia.id.in_([row.id for row in removed]))
        )
    for position, item in enumerate(media):
        item.post_id, item.position = post.id, position

    status, note = _review_status(kind, verdict)
    post.body = candidate.body
    post.milestone = (
        candidate.milestone_data.model_dump(mode="json") if candidate.milestone_data else None
    )
    post.moderation_status, post.moderation_note = status, note
    post.updated_at = datetime.now(UTC)
    profile.embedding_v += 1
    await session.commit()
    if removed_paths:
        try:
            await storage.delete_objects(removed_paths)
        except UpstreamServiceError:
            logger.warning("Could not delete %d replaced image objects", len(removed_paths))
    logger.info("post_edited post_id=%s", post_id)
    return PostCreatedResponse(post_id=post_id)


async def delete_post(
    session: AsyncSession, clerk_user_id: str, post_id: UUID
) -> PostDeletedResponse:
    profile = await get_role_profile(session, clerk_user_id, AppRole.FOUNDER)
    post = await _own_post(session, profile.id, post_id)
    # Soft delete (PRD M4 AC9): hidden now, erased by the purge_posts worker after 30 days.
    post.deleted_at = datetime.now(UTC)
    profile.embedding_v += 1
    await session.commit()
    logger.info("post_deleted post_id=%s", post_id)
    return PostDeletedResponse()


def _parse_cursor(cursor: str | None) -> tuple[datetime, UUID] | None:
    if not cursor:
        return None
    try:
        stamp, raw_id = cursor.split("|", 1)
        return datetime.fromisoformat(stamp), UUID(raw_id)
    except ValueError as exc:
        raise _problem(
            422, "invalid-cursor", "Invalid page", "Reload the page and try again."
        ) from exc


def _milestone(raw: dict[str, object] | None) -> MilestoneData | None:
    if not raw:
        return None
    try:
        return MilestoneData.model_validate(raw)
    except ValidationError:
        return None


async def _posts_page(session: AsyncSession, profile_id: UUID, cursor: str | None) -> PostsPage:
    query = select(Post).where(Post.profile_id == profile_id, Post.deleted_at.is_(None))
    parsed = _parse_cursor(cursor)
    if parsed is not None:
        query = query.where(
            tuple_(Post.created_at, Post.id) < tuple_(literal(parsed[0]), literal(parsed[1]))
        )
    rows = (
        await session.scalars(
            query.order_by(Post.created_at.desc(), Post.id.desc()).limit(PAGE_SIZE + 1)
        )
    ).all()
    page: Sequence[Post] = rows[:PAGE_SIZE]
    media_rows = (
        (
            await session.scalars(
                select(PostMedia)
                .where(PostMedia.post_id.in_([post.id for post in page]))
                .order_by(PostMedia.post_id, PostMedia.position)
            )
        ).all()
        if page
        else []
    )
    await session.commit()  # end the read transaction before calling Storage

    try:
        urls = await storage.signed_urls(
            [path for row in media_rows for path in (row.storage_path, row.thumbnail_path)]
        )
    except UpstreamServiceError:
        logger.warning("Signing post image URLs failed; images render as unavailable")
        urls = {}
    media_by_post: dict[UUID, list[PostMediaItem]] = {}
    for row in media_rows:
        if row.post_id is None:
            continue
        media_by_post.setdefault(row.post_id, []).append(
            PostMediaItem(
                media_id=row.id,
                url=urls.get(row.storage_path),
                thumbnail_url=urls.get(row.thumbnail_path),
                width=row.width,
                height=row.height,
            )
        )
    items = [
        PostItem(
            post_id=post.id,
            kind=PostKind(post.kind),
            body=post.body,
            milestone_data=_milestone(post.milestone),
            media=media_by_post.get(post.id, []),
            created_at=post.created_at,
            updated_at=post.updated_at,
            edited=post.updated_at - post.created_at > EDITED_AFTER,
        )
        for post in page
    ]
    last = page[-1] if page else None
    next_cursor = (
        f"{last.created_at.isoformat()}|{last.id}"
        if last is not None and len(rows) > PAGE_SIZE
        else None
    )
    return PostsPage(items=items, next_cursor=next_cursor)


async def list_own_posts(
    session: AsyncSession, clerk_user_id: str, cursor: str | None
) -> PostsPage:
    profile = await get_role_profile(session, clerk_user_id, AppRole.FOUNDER)
    return await _posts_page(session, profile.id, cursor)


async def list_profile_posts(
    session: AsyncSession, clerk_user_id: str, profile_id: UUID, cursor: str | None
) -> PostsPage:
    """Posts are visible to the author and to people matched with them (M10 AC7)."""
    viewer_profile = aliased(Profile)
    viewer_user = aliased(User)
    viewer_profile_ids = (
        select(viewer_profile.id)
        .join(viewer_user, viewer_profile.user_id == viewer_user.id)
        .where(viewer_user.clerk_id == clerk_user_id)
    )
    visible: UUID | None = await session.scalar(
        select(Profile.id)
        .join(User, Profile.user_id == User.id)
        .where(
            Profile.id == profile_id,
            Profile.kind == AppRole.FOUNDER,
            User.deleted_at.is_(None),
            User.matching_enabled.is_(True),
            or_(
                Profile.id.in_(viewer_profile_ids),
                exists().where(
                    Match.from_profile_id.in_(viewer_profile_ids),
                    Match.to_profile_id == Profile.id,
                ),
            ),
        )
    )
    if visible is None:
        raise _problem(
            404,
            "profile-not-found",
            "Profile not found",
            "This profile doesn't exist or isn't visible to you.",
        )
    return await _posts_page(session, profile_id, cursor)


async def upload_media(
    session: AsyncSession, clerk_user_id: str, data: bytes
) -> MediaUploadResponse:
    profile = await get_role_profile(session, clerk_user_id, AppRole.FOUNDER)
    profile_id = profile.id
    recent: int | None = await session.scalar(
        select(func.count())
        .select_from(PostMedia)
        .where(
            PostMedia.profile_id == profile_id,
            PostMedia.created_at >= datetime.now(UTC) - timedelta(hours=1),
        )
    )
    if (recent or 0) >= MAX_UPLOADS_PER_HOUR:
        raise _problem(
            429,
            "upload-limit-reached",
            "Too many uploads",
            "You've uploaded a lot of images. Try again in an hour.",
        )
    await session.commit()  # release the connection during image processing and upload

    try:
        processed = await asyncio.to_thread(process_image, data)
    except InvalidImageError as exc:
        raise _problem(
            422, "invalid-image", "Unsupported image", "Upload a JPG, PNG, or WebP image."
        ) from exc

    media_id = uuid4()
    full_path = f"{profile_id}/{media_id}.{processed.extension}"
    thumbnail_path = f"{profile_id}/{media_id}-thumb.webp"
    await storage.upload_object(full_path, processed.data, processed.content_type)
    try:
        await storage.upload_object(thumbnail_path, processed.thumbnail, "image/webp")
    except UpstreamServiceError:
        try:
            await storage.delete_objects([full_path])
        except UpstreamServiceError:
            logger.warning("Could not clean up image %s after a failed thumbnail upload", media_id)
        raise

    session.add(
        PostMedia(
            id=media_id,
            profile_id=profile_id,
            storage_path=full_path,
            thumbnail_path=thumbnail_path,
            content_type=processed.content_type,
            size_bytes=len(processed.data),
            width=processed.width,
            height=processed.height,
        )
    )
    await session.commit()
    try:
        urls = await storage.signed_urls([full_path, thumbnail_path])
    except UpstreamServiceError:
        urls = {}
    return MediaUploadResponse(
        media_id=media_id,
        url=urls.get(full_path),
        thumbnail_url=urls.get(thumbnail_path),
        width=processed.width,
        height=processed.height,
    )
