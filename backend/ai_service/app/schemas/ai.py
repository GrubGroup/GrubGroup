"""Pydantic DTOs for AI endpoints (no table backing)."""

from pydantic import BaseModel


class EmbedRequest(BaseModel):
    """Request body for POST /api/v1/embed."""

    text: str


class EmbedResponse(BaseModel):
    """Response body for POST /api/v1/embed: a 1024-dim embedding vector."""

    embedding: list[float]
