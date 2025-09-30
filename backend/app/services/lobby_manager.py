from __future__ import annotations

import asyncio
import logging
from contextlib import suppress
from typing import Dict, List, Optional, Tuple, TYPE_CHECKING

from fastapi import WebSocket

from .constants import MAX_NAME_LENGTH, RECONNECT_GRACE_SECONDS

logger = logging.getLogger("lobby")

if TYPE_CHECKING:
    from .game_manager import GameManager, GameSession


class LobbyPlayer:
    def __init__(self, player_id: str, name: str, websocket: Optional[WebSocket]) -> None:
        self.id = player_id
        self.name = name
        self.websocket: Optional[WebSocket] = websocket
        self.connected = websocket is not None


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
                logger.info("Player %s removed after grace period (%s)", player_id, player.name)
            await self.broadcast_state()
        except asyncio.CancelledError:
            logger.debug("Reconnect timer for %s cancelled", player_id)
        finally:
            self.disconnect_tasks.pop(player_id, None)
