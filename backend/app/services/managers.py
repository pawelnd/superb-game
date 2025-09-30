from __future__ import annotations

import asyncio
import logging
from contextlib import suppress
from typing import Dict, List, Optional, Tuple

from fastapi import WebSocket, WebSocketDisconnect

RECONNECT_GRACE_SECONDS = 10
SESSION_CLEANUP_GRACE_SECONDS = 20
MAX_NAME_LENGTH = 24

logger = logging.getLogger("lobby")

class LobbyPlayer:
    def __init__(self, player_id: str, name: str, websocket: Optional[WebSocket]) -> None:
        self.id = player_id
        self.name = name
        self.websocket: Optional[WebSocket] = websocket
        self.connected = websocket is not None

async def safe_send(websocket: Optional[WebSocket], payload: Dict) -> None:
    if websocket is None:
        return
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
        self.disconnect_tasks: Dict[str, asyncio.Task] = {}

    async def register_player(
        self,
        websocket: WebSocket,
        name: str,
        player_id: Optional[str] = None,
    ) -> LobbyPlayer:
        from uuid import uuid4

        sanitized_name = name.strip()[:MAX_NAME_LENGTH] if name else ""
        async with self.lock:
            player: Optional[LobbyPlayer]
            if player_id and player_id in self.players:
                player = self.players[player_id]
                if sanitized_name:
                    player.name = sanitized_name
                player.websocket = websocket
                player.connected = True
                logger.info("Player %s reconnected as %s", player.id, player.name)
            else:
                generated_id = player_id or str(uuid4())
                player = LobbyPlayer(generated_id, sanitized_name or generated_id[:6], websocket)
                self.players[player.id] = player
                logger.info("Player %s connected as %s", player.id, player.name)
                player_id = player.id
            task = self.disconnect_tasks.pop(player.id, None)
        if task:
            logger.info("Cancelled disconnect timer for %s", player.id)
            task.cancel()
            with suppress(asyncio.CancelledError):
                await task
        return player

    async def remove_player(self, player_id: str) -> None:
        async with self.lock:
            player = self.players.pop(player_id, None)
            if player_id in self.queue:
                self.queue.remove(player_id)
                logger.info("Player %s removed from ready queue", player_id)
            task = self.disconnect_tasks.pop(player_id, None)
        if task:
            task.cancel()
            with suppress(asyncio.CancelledError):
                await task
        if player:
            logger.info("Player %s removed from lobby (%s)", player_id, player.name)

    async def set_ready(self, player_id: str, ready: bool) -> None:
        async with self.lock:
            if ready:
                if player_id not in self.queue:
                    self.queue.append(player_id)
                    logger.info("Player %s marked ready", player_id)
            else:
                if player_id in self.queue:
                    self.queue.remove(player_id)
                    logger.info("Player %s unmarked as ready", player_id)

    async def snapshot(self) -> Tuple[List[Dict], List[Tuple[str, WebSocket]]]:
        async with self.lock:
            players_payload = [
                {
                    "id": pid,
                    "name": player.name,
                    "isReady": pid in self.queue,
                    "isConnected": player.connected,
                }
                for pid, player in self.players.items()
            ]
            sockets = [
                (pid, player.websocket)
                for pid, player in self.players.items()
                if player.websocket is not None
            ]
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
            logger.warning("Dropping stale socket for player %s", player_id)
            await self.remove_player(player_id)

    async def try_matchmake(self, game_manager: "GameManager") -> None:
        matches: List[Tuple[LobbyPlayer, LobbyPlayer, "GameSession"]] = []
        while True:
            async with self.lock:
                ready_ids = [pid for pid in self.queue if pid in self.players and self.players[pid].connected]
                if len(ready_ids) < 2:
                    break
                first_id = ready_ids.pop(0)
                second_id = ready_ids.pop(0)
                self.queue = [pid for pid in self.queue if pid not in {first_id, second_id}]
                first_player = self.players.get(first_id)
                second_player = self.players.get(second_id)
            if not first_player or not second_player:
                continue
            logger.info("Matched players %s and %s", first_id, second_id)
            session = await game_manager.create_session(first_player, second_player)
            matches.append((first_player, second_player, session))
        if matches:
            await self.broadcast_state()
            for player_one, player_two, session in matches:
                await game_manager.notify_match_found(session, player_one, player_two)
        if matches:
            await self.broadcast_state()
            for player_one, player_two, session in matches:
                await game_manager.notify_match_found(session, player_one, player_two)

    async def schedule_disconnect(self, player_id: str) -> None:
        async with self.lock:
            player = self.players.get(player_id)
            if not player:
                return
            player.connected = False
            player.websocket = None
            if player_id in self.queue:
                self.queue.remove(player_id)
                logger.info("Player %s removed from ready queue due to disconnect", player_id)
            if player_id in self.disconnect_tasks:
                logger.debug("Disconnect timer for %s already scheduled", player_id)
                return
            logger.info(
                "Player %s disconnected; waiting %s seconds for reconnect",
                player_id,
                RECONNECT_GRACE_SECONDS,
            )
            task = asyncio.create_task(self._delayed_remove(player_id))
            self.disconnect_tasks[player_id] = task

    async def _delayed_remove(self, player_id: str) -> None:
        try:
            await asyncio.sleep(RECONNECT_GRACE_SECONDS)
            async with self.lock:
                player = self.players.get(player_id)
                if player and not player.connected:
                    player = self.players.pop(player_id, None)
            if player:
                logger.info('Player %s removed after grace period', player_id)
            await self.broadcast_state()
        except asyncio.CancelledError:
            logger.debug('Reconnect timer for %s cancelled', player_id)
        finally:
            self.disconnect_tasks.pop(player_id, None)

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
            logger.info('Player %s joined game %s', player_id, self.id)

    async def remove_connection(self, player_id: str) -> None:
        async with self.lock:
            removed = self.connections.pop(player_id, None)
            if removed:
                logger.info('Player %s left game %s', player_id, self.id)

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
        await session.record_state(sender_id, state)
        await session.send_to_opponent(sender_id, {"type": "opponent_state", "playerId": sender_id, "state": state})

    async def forward_game_over(self, session_id: str, sender_id: str, state: Dict) -> None:
        session = await self.get_session(session_id)
        if not session:
            return
        await session.record_state(sender_id, state)
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
            await self.schedule_cleanup(session_id)

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

    async def _delayed_cleanup(self, session_id: str) -> None:
        try:
            await asyncio.sleep(SESSION_CLEANUP_GRACE_SECONDS)
            session = await self.get_session(session_id)
            if not session:
                return
            if await session.connected_count() == 0 or session.finished:
                await self.remove_session(session_id)
        except asyncio.CancelledError:
            pass
        finally:
            self.cleanup_tasks.pop(session_id, None)




