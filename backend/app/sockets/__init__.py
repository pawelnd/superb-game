from fastapi import FastAPI

from .game import router as game_router
from .lobby import router as lobby_router


def register_sockets(app: FastAPI) -> None:
    app.include_router(lobby_router)
    app.include_router(game_router)