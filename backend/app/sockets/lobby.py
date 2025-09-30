from typing import Optional

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from ..services import GameManager, LobbyManager, safe_send

router = APIRouter()


@router.websocket("/ws/lobby")
async def lobby_endpoint(websocket: WebSocket) -> None:
    await websocket.accept()
    player_id: Optional[str] = None

    lobby_manager: LobbyManager = websocket.app.state.lobby_manager
    game_manager: GameManager = websocket.app.state.game_manager

    try:
        while True:
            message = await websocket.receive_json()
            message_type = message.get("type")

            if message_type == "join":
                requested_id = message.get("playerId")
                incoming_name = (message.get("name") or "").strip()
                if not incoming_name and not requested_id:
                    await safe_send(websocket, {"type": "error", "message": "Name is required"})
                    continue

                player = await lobby_manager.register_player(websocket, incoming_name, requested_id)
                player_id = player.id
                players_payload, _ = await lobby_manager.snapshot()
                await safe_send(
                    websocket,
                    {
                        "type": "joined",
                        "playerId": player.id,
                        "playerName": player.name,
                        "players": players_payload,
                    },
                )
                await lobby_manager.broadcast_state()

            elif message_type == "set_ready" and player_id:
                ready = bool(message.get("ready", False))
                await lobby_manager.set_ready(player_id, ready)
                await lobby_manager.broadcast_state()
                await lobby_manager.try_matchmake(game_manager)

            elif message_type == "leave" and player_id:
                await lobby_manager.remove_player(player_id)
                await lobby_manager.broadcast_state()
                player_id = None
                break

    except WebSocketDisconnect:
        pass
    finally:
        if player_id:
            await lobby_manager.schedule_disconnect(player_id)
