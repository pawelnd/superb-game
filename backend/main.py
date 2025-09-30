from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routes import register_routes
from app.services.managers import GameManager, LobbyManager
from app.sockets import register_sockets

API_TITLE = "Superb Game API"
API_VERSION = "2.0.0"
CORS_ORIGINS = ["http://localhost:3000", "http://frontend:3000"]


def create_app() -> FastAPI:
    app = FastAPI(title=API_TITLE, version=API_VERSION)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    register_routes(app)
    register_sockets(app)

    app.state.lobby_manager = LobbyManager()
    app.state.game_manager = GameManager()

    return app


app = create_app()


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", port=8000, reload=True)