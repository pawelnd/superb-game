from __future__ import annotations

import asyncio
from typing import Dict, List, Optional, Tuple

from fastapi import WebSocket, WebSocketDisconnect


class LobbyPlayer:
    def __init__(self, player_id: str, name: str, websocket: WebSocket) -> None:
        self.id = player_id
        self.name = name
        self.websocket = websocket


async def safe_send(websocket: WebSocket, payload: Dict) -> None:
    try:
        await websocket.send_json(payload)
    except WebSocketDisconnect:
        pass
    except RuntimeError:
        pass


class LobbyManager:
    def __init__(self) -> None:
        self.players: Dict[str, LobbyPlayer] = {}
        self.queue: List[str] = []
        self.lock = asyncio.Lock()

    async def add_player(self, player_id: str, name: str, websocket: WebSocket) -> LobbyPlayer:
        player = LobbyPlayer(player_id, name, websocket)
        async with self.lock:
            self.players[player_id] = player
        return player

    async def remove_player(self, player_id: str) -> None:
        async with self.lock:
            self.players.pop(player_id, None)
            if player_id in self.queue:
                self.queue.remove(player_id)

    async def set_ready(self, player_id: str, ready: bool) -> None:
        async with self.lock:
            if ready and player_id not in self.queue:
                self.queue.append(player_id)
            if not ready and player_id in self.queue:
                self.queue.remove(player_id)

    async def snapshot(self) -> Tuple[List[Dict], List[Tuple[str, WebSocket]]]:
        async with self.lock:
            players_payload = [
                {"id": pid, "name": player.name, "isReady": pid in self.queue}
                for pid, player in self.players.items()
            ]
            sockets = [(pid, player.websocket) for pid, player in self.players.items()]
        return players_payload, sockets

    async def broadcast_state(self) -> None:
        players_payload, sockets = await self.snapshot()
        message = {"type": "lobby_state", "players": players_payload}
        stale: List[str] = []
        for player_id, websocket in sockets:
            try:
                await websocket.send_json(message)
            except Exception:
                stale.append(player_id)
        for player_id in stale:
            await self.remove_player(player_id)

    async def try_matchmake(self, game_manager: "GameManager") -> None:
        matches: List[Tuple[LobbyPlayer, LobbyPlayer, "GameSession"]] = []
        while True:
            async with self.lock:
                if len(self.queue) < 2:
                    break
                first_id = self.queue.pop(0)
                second_id = self.queue.pop(0)
                first_player = self.players.get(first_id)
                second_player = self.players.get(second_id)
            if not first_player or not second_player:
                continue
            session = await game_manager.create_session(first_player, second_player)
            matches.append((first_player, second_player, session))
        if matches:
            await self.broadcast_state()
            for player_one, player_two, session in matches:
                await game_manager.notify_match_found(session, player_one, player_two)


class GameSession:
    def __init__(self, session_id: str, players: Dict[str, str]) -> None:
        self.id = session_id
        self.players = players
        self.connections: Dict[str, WebSocket] = {}
        self.lock = asyncio.Lock()
        self.finished = False

    def opponent_for(self, player_id: str) -> Optional[Tuple[str, str]]:
        for pid, name in self.players.items():
            if pid != player_id:
                return pid, name
        return None

    async def add_connection(self, player_id: str, websocket: WebSocket) -> None:
        async with self.lock:
            self.connections[player_id] = websocket

    async def remove_connection(self, player_id: str) -> None:
        async with self.lock:
            self.connections.pop(player_id, None)

    async def broadcast(self, payload: Dict, exclude: Optional[str] = None) -> None:
        async with self.lock:
            targets = [ws for pid, ws in self.connections.items() if pid != exclude]
        for websocket in targets:
            await safe_send(websocket, payload)

    async def send_to_opponent(self, sender_id: str, payload: Dict) -> None:
        opponent = self.opponent_for(sender_id)
        if not opponent:
            return
        opponent_id, _ = opponent
        async with self.lock:
            websocket = self.connections.get(opponent_id)
        if websocket:
            await safe_send(websocket, payload)

    async def connected_count(self) -> int:
        async with self.lock:
            return len(self.connections)


class GameManager:
    def __init__(self) -> None:
        self.sessions: Dict[str, GameSession] = {}
        self.lock = asyncio.Lock()

    async def create_session(self, player_one: LobbyPlayer, player_two: LobbyPlayer) -> GameSession:
        from uuid import uuid4

        session_id = str(uuid4())
        session = GameSession(session_id, {player_one.id: player_one.name, player_two.id: player_two.name})
        async with self.lock:
            self.sessions[session_id] = session
        return session

    async def get_session(self, session_id: str) -> Optional[GameSession]:
        async with self.lock:
            return self.sessions.get(session_id)

    async def remove_session(self, session_id: str) -> None:
        async with self.lock:
            self.sessions.pop(session_id, None)

    async def notify_match_found(self, session: GameSession, player_one: LobbyPlayer, player_two: LobbyPlayer) -> None:
        payload_one = {
            "type": "match_found",
            "gameId": session.id,
            "opponent": {"id": player_two.id, "name": player_two.name},
        }
        payload_two = {
            "type": "match_found",
            "gameId": session.id,
            "opponent": {"id": player_one.id, "name": player_one.name},
        }
        await safe_send(player_one.websocket, payload_one)
        await safe_send(player_two.websocket, payload_two)

    async def forward_state(self, session_id: str, sender_id: str, state: Dict) -> None:
        session = await self.get_session(session_id)
        if not session:
            return
        await session.send_to_opponent(sender_id, {"type": "opponent_state", "playerId": sender_id, "state": state})

    async def forward_game_over(self, session_id: str, sender_id: str, state: Dict) -> None:
        session = await self.get_session(session_id)
        if not session:
            return
        session.finished = True
        await session.send_to_opponent(
            sender_id,
            {"type": "opponent_game_over", "playerId": sender_id, "state": state},
        )

    async def handle_disconnect(self, session_id: str, player_id: str) -> None:
        session = await self.get_session(session_id)
        if not session:
            return
        await session.remove_connection(player_id)
        await session.broadcast({"type": "opponent_left", "playerId": player_id}, exclude=player_id)
        if await session.connected_count() == 0:
            await self.remove_session(session_id)