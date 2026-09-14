import asyncio
import contextlib
import logging
from datetime import UTC, datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect

from app.config import get_settings
from app.db.session import get_session_factory
from app.errors import ProblemError, UpstreamServiceError
from app.models.messages import (
    MessageCreatedResponse,
    MessageCreateRequest,
    MessageItem,
    MessagesReadResponse,
    ThreadItem,
    ThreadsResponse,
)
from app.routers.dependencies import ClerkUserId, SessionDep
from app.services import messages
from app.services.clerk import InvalidSessionTokenError, verify_session_token
from app.services.connections import require_viewer
from app.services.realtime import hub

logger = logging.getLogger(__name__)
router = APIRouter(tags=["messages"])

AUTH_TIMEOUT_SECONDS = 10
IDLE_TIMEOUT_SECONDS = 90  # clients ping every 25 seconds
MAX_CONNECTION_SECONDS = 60 * 60  # then the client reconnects with a fresh session token
CLOSE_POLICY = 1008
CLOSE_TRY_AGAIN = 1013
CLOSE_REAUTH = 4000
CLOSE_UNAUTHORIZED = 4401
CLOSE_FORBIDDEN = 4403


# Declared before /v1/messages/{match_id} so "threads" isn't parsed as a match id.
@router.get("/v1/messages/threads", response_model=ThreadsResponse)
async def read_threads(session: SessionDep, clerk_user_id: ClerkUserId) -> ThreadsResponse:
    return await messages.list_threads(session, clerk_user_id)


@router.get("/v1/messages/threads/{match_id}", response_model=ThreadItem)
async def read_thread(
    match_id: UUID, session: SessionDep, clerk_user_id: ClerkUserId
) -> ThreadItem:
    return await messages.get_thread(session, clerk_user_id, match_id)


@router.get("/v1/messages/{match_id}", response_model=list[MessageItem])
async def read_messages(
    match_id: UUID,
    session: SessionDep,
    clerk_user_id: ClerkUserId,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
    before: Annotated[datetime | None, Query()] = None,
) -> list[MessageItem]:
    if before is not None and before.tzinfo is None:
        before = before.replace(tzinfo=UTC)
    return await messages.list_messages(
        session, clerk_user_id, match_id, limit=limit, before=before
    )


@router.post("/v1/messages/{match_id}", response_model=MessageCreatedResponse, status_code=201)
async def send_message(
    match_id: UUID, body: MessageCreateRequest, session: SessionDep, clerk_user_id: ClerkUserId
) -> MessageCreatedResponse:
    return await messages.send_message(session, clerk_user_id, match_id, body)


@router.post("/v1/messages/{match_id}/read", response_model=MessagesReadResponse)
async def mark_read(
    match_id: UUID, session: SessionDep, clerk_user_id: ClerkUserId
) -> MessagesReadResponse:
    return await messages.mark_thread_read(session, clerk_user_id, match_id)


async def _close(websocket: WebSocket, code: int) -> None:
    with contextlib.suppress(RuntimeError, WebSocketDisconnect):
        await websocket.close(code=code)


async def _authenticate(websocket: WebSocket) -> UUID | None:
    """The first frame carries the Clerk session token, so it never appears in a URL or log."""
    try:
        hello = await asyncio.wait_for(websocket.receive_json(), timeout=AUTH_TIMEOUT_SECONDS)
    except (TimeoutError, WebSocketDisconnect, ValueError):
        await _close(websocket, CLOSE_UNAUTHORIZED)
        return None
    token = hello.get("token") if isinstance(hello, dict) and hello.get("type") == "auth" else None
    if not isinstance(token, str) or not token:
        await _close(websocket, CLOSE_UNAUTHORIZED)
        return None
    try:
        claims = await verify_session_token(token)
    except InvalidSessionTokenError:
        await _close(websocket, CLOSE_UNAUTHORIZED)
        return None
    except UpstreamServiceError:
        await _close(websocket, CLOSE_TRY_AGAIN)
        return None
    async with get_session_factory()() as session:
        try:
            viewer = await require_viewer(session, claims.sub)
        except ProblemError:
            await _close(websocket, CLOSE_FORBIDDEN)
            return None
    return viewer.profile_id


@router.websocket("/v1/ws")
async def realtime_socket(websocket: WebSocket) -> None:
    # Browsers don't apply CORS to WebSockets, so the origin is checked here.
    if websocket.headers.get("origin") not in get_settings().cors_origin_list:
        await _close(websocket, CLOSE_POLICY)
        return
    await websocket.accept()
    profile_id = await _authenticate(websocket)
    if profile_id is None:
        return

    hub.add(profile_id, websocket)
    loop = asyncio.get_running_loop()
    deadline = loop.time() + MAX_CONNECTION_SECONDS
    try:
        await websocket.send_json({"type": "ready"})
        while True:
            remaining = deadline - loop.time()
            try:
                incoming = await asyncio.wait_for(
                    websocket.receive_json(), timeout=max(0.0, min(IDLE_TIMEOUT_SECONDS, remaining))
                )
            except TimeoutError:
                await _close(websocket, CLOSE_REAUTH)
                break
            if isinstance(incoming, dict) and incoming.get("type") == "ping":
                await websocket.send_json({"type": "pong"})
    except (WebSocketDisconnect, ValueError, RuntimeError):
        pass
    finally:
        hub.remove(profile_id, websocket)
