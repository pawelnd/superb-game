from __future__ import annotations

from typing import Dict, Optional

from fastapi import WebSocket, WebSocketDisconnect


async def safe_send(websocket: Optional[WebSocket], payload: Dict) -> None:
    """Send JSON over a websocket, ignoring errors when the peer is gone."""
    if websocket is None:
        return
    try:
        await websocket.send_json(payload)
    except WebSocketDisconnect:
        pass
    except RuntimeError:
        # Raised when the connection is already closing/closed
        pass
