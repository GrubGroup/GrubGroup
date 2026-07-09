"""FastAPI app factory: create_app() wires routers, middleware, and lifespan."""

from fastapi import FastAPI

from app.api.v1.router import api_router


def create_app() -> FastAPI:
    """Build the FastAPI application and mount the v1 router."""
    app = FastAPI(title="GrubGroup ai_service")
    app.include_router(api_router)
    return app


app = create_app()
