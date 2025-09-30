from __future__ import annotations

import asyncio
import logging
from contextlib import suppress
from typing import Dict, Optional, Tuple

from fastapi import WebSocket

from .constants import SESSION_CLEANUP_GRACE_SECONDS
from .lobby_manager import LobbyPlayer
from .utils import safe_send

logger = logging.getLogger("lobby.game")


class GameSession:
    def __init__(self, session_id: str, players: Dict[str, str]) -> None:
        self.id = session_id
        self.players = players
        self.connections: Dict[str, WebSocket] = {}
        self.last_states: Dict[str, Dict] = {}
        self.lock = asyncio.Lock()
        self.finished = False
        self.started = False

    def opponent_for(self, player_id: str) -> Optional[Tuple[str, str]]:
        for pid, name in self.players.items():
            if pid != player_id:
                return pid, name
        return None

    async def add_connection(self, player_id: str, websocket: WebSocket) -> None:
        async with self.lock:
            self.connections[player_id] = websocket
        logger.info("Player %s joined game %s", player_id, self.id)

    async def remove_connection(self, player_id: str) -> None:
        async with self.lock:
            removed = self.connections.pop(player_id, None)
        if removed:
            logger.info("Player %s left game %s", player_id, self.id)

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

    async def record_state(self, player_id: str, state: Dict) -> None:
        async with self.lock:
            self.last_states[player_id] = state

    async def get_state(self, player_id: str) -> Optional[Dict]:
        async with self.lock:
            return self.last_states.get(player_id)


class GameManager:
    def __init__(self) -> None:
        self.sessions: Dict[str, GameSession] = {}
        self.lock = asyncio.Lock()
        self.cleanup_tasks: Dict[str, asyncio.Task] = {}

    async def create_session(self, player_one: LobbyPlayer, player_two: LobbyPlayer) -> GameSession:
        from uuid import uuid4

        session_id = str(uuid4())
        session = GameSession(session_id, {player_one.id: player_one.name, player_two.id: player_two.name})
        async with self.lock:
            self.sessions[session_id] = session
        logger.info("Session %s created for players %s vs %s", session_id, player_one.id, player_two.id)
        return session

    async def get_session(self, session_id: str) -> Optional[GameSession]:
        async with self.lock:
            return self.sessions.get(session_id)

    async def remove_session(self, session_id: str) -> None:
        async with self.lock:
            session = self.sessions.pop(session_id, None)
        task = self.cleanup_tasks.pop(session_id, None)
        if task:
            task.cancel()
            with suppress(asyncio.CancelledError):
                await task
        if session:
            async with session.lock:
                session.connections.clear()
                session.last_states.clear()
            logger.info("Session %s removed", session_id)

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
        logger.info("Session %s match notification sent to %s and %s", session.id, player_one.id, player_two.id)

    async def forward_state(self, session_id: str, sender_id: str, state: Dict) -> None:
        session = await self.get_session(session_id)
        if not session:
            return
        await session.record_state(sender_id, state)
        await session.send_to_opponent(sender_id, {"type": "opponent_state", "playerId": sender_id, "state": state})
        logger.debug("Session %s state update from %s", session_id, sender_id)

    async def forward_game_over(self, session_id: str, sender_id: str, state: Dict) -> None:
        session = await self.get_session(session_id)
        if not session:
            return
        await session.record_state(sender_id, state)
        session.finished = True
        logger.info("Session %s marked finished by %s", session_id, sender_id)
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
        logger.info("Session %s player %s disconnected", session_id, player_id)
        if await session.connected_count() == 0:
            await self.schedule_cleanup(session_id)
            logger.info("Session %s has no active connections; cleanup scheduled", session_id)

    async def schedule_cleanup(self, session_id: str) -> None:
        async with self.lock:
            if session_id in self.cleanup_tasks:
                return
            task = asyncio.create_task(self._delayed_cleanup(session_id))
            self.cleanup_tasks[session_id] = task

    async def cancel_cleanup(self, session_id: str) -> None:
        task = self.cleanup_tasks.pop(session_id, None)
        if task:
            task.cancel()
            with suppress(asyncio.CancelledError):
                await task
            logger.info("Session %s cleanup cancelled", session_id)

    async def _delayed_cleanup(self, session_id: str) -> None:
        try:
            await asyncio.sleep(SESSION_CLEANUP_GRACE_SECONDS)
            session = await self.get_session(session_id)
            if not session:
                return
            if await session.connected_count() == 0 or session.finished:
                logger.info("Session %s cleanup executed", session_id)
                await self.remove_session(session_id)
            else:
                logger.debug("Session %s cleanup skipped; players still connected", session_id)
        except asyncio.CancelledError:
            pass
        finally:
            self.cleanup_tasks.pop(session_id, None)
