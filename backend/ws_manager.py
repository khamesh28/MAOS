"""
WebSocket Connection Manager for Genpact AI Hub.
Manages live streaming of AutoGen pipeline messages to connected browser clients.
"""

import asyncio
from typing import Dict, List
from fastapi import WebSocket


class ConnectionManager:
    def __init__(self):
        self._connections: Dict[str, List[WebSocket]] = {}

    async def connect(self, run_id: str, websocket: WebSocket):
        await websocket.accept()
        self._connections.setdefault(run_id, []).append(websocket)

    def disconnect(self, run_id: str, websocket: WebSocket):
        if run_id in self._connections:
            self._connections[run_id] = [
                ws for ws in self._connections[run_id] if ws is not websocket
            ]
            if not self._connections[run_id]:
                del self._connections[run_id]

    async def broadcast(self, run_id: str, data: dict):
        for ws in list(self._connections.get(run_id, [])):
            try:
                await ws.send_json(data)
            except Exception:
                pass

    def broadcast_from_thread(self, run_id: str, data: dict, loop: asyncio.AbstractEventLoop):
        """Thread-safe fire-and-forget broadcast — call from non-async background thread."""
        if not self._connections.get(run_id):
            return  # no connected clients — skip silently
        try:
            asyncio.run_coroutine_threadsafe(self.broadcast(run_id, data), loop)
        except Exception:
            pass


ws_manager = ConnectionManager()
