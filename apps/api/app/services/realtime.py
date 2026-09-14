"""In-process WebSocket fan-out (S6).

Connections live in this API process, which is fine for the single Railway instance. Before
running more than one replica, publish events through Redis pub/sub (Upstash) so every instance
delivers them.
"""

import asyncio
import logging
from typing import Any
from uuid import UUID

from starlette.websockets import WebSocket, WebSocketDisconnect

logger = logging.getLogger(__name__)

SEND_TIMEOUT_SECONDS = 5.0


class RealtimeHub:
    def __init__(self) -> None:
        self._sockets: dict[UUID, set[WebSocket]] = {}

    def add(self, profile_id: UUID, websocket: WebSocket) -> None:
        self._sockets.setdefault(profile_id, set()).add(websocket)

    def remove(self, profile_id: UUID, websocket: WebSocket) -> None:
        sockets = self._sockets.get(profile_id)
        if sockets is None:
            return
        sockets.discard(websocket)
        if not sockets:
            del self._sockets[profile_id]

    def connection_count(self) -> int:
        return sum(len(sockets) for sockets in self._sockets.values())

    async def publish(self, profile_id: UUID, event: dict[str, Any]) -> None:
        """Best effort: a slow or dead socket is dropped; the client resyncs when it reconnects."""
        for websocket in list(self._sockets.get(profile_id, ())):
            try:
                await asyncio.wait_for(websocket.send_json(event), timeout=SEND_TIMEOUT_SECONDS)
            except (TimeoutError, WebSocketDisconnect, RuntimeError, OSError):
                logger.info("realtime_socket_dropped")
                self.remove(profile_id, websocket)


hub = RealtimeHub()
