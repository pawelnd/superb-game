from fastapi import FastAPI

from .core import router as core_router


def register_routes(app: FastAPI) -> None:
    app.include_router(core_router)