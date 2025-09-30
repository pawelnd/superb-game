from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from ..services.managers import GameManager, safe_send

router = APIRouter()


@router.websocket("/ws/game/{game_id}")
async def game_endpoint(websocket: WebSocket, game_id: str) -> None:
    player_id = websocket.query_params.get("playerId")
    game_manager: GameManager = websocket.app.state.game_manager

    if not player_id:
        await websocket.close(code=1008)
        return

    session = await game_manager.get_session(game_id)
    if not session or player_id not in session.players:
        await websocket.close(code=1008)
        return

    await websocket.accept()
    await session.add_connection(player_id, websocket)
    await game_manager.cancel_cleanup(game_id)

    opponent = session.opponent_for(player_id)
    await safe_send(
        websocket,
        {
            "type": "connected",
            "you": {"id": player_id, "name": session.players[player_id]},
            "opponent": {"id": opponent[0], "name": opponent[1]} if opponent else None,
        },
    )

    connected_count = await session.connected_count()
    if connected_count == len(session.players):
        if not session.started:
            session.started = True
            await session.broadcast({"type": "start"})
        else:
            await session.broadcast({"type": "opponent_returned", "playerId": player_id}, exclude=player_id)
            await safe_send(websocket, {"type": "start"})

    own_state = await session.get_state(player_id)
    if own_state:
        await safe_send(websocket, {"type": "resume_state", "state": own_state})

    if opponent:
        opponent_state = await session.get_state(opponent[0])
        if opponent_state:
            await safe_send(
                websocket,
                {
                    "type": "opponent_state",
                    "playerId": opponent[0],
                    "state": opponent_state,
                },
            )

    try:
        while True:
            payload = await websocket.receive_json()
            message_type = payload.get("type")

            if message_type == "state_update":
                state = payload.get("state", {})
                await game_manager.forward_state(game_id, player_id, state)
            elif message_type == "game_over":
                state = payload.get("state", {})
                await game_manager.forward_game_over(game_id, player_id, state)
            elif message_type == "leave":
                break

    except WebSocketDisconnect:
        pass
    finally:
        await game_manager.handle_disconnect(game_id, player_id)