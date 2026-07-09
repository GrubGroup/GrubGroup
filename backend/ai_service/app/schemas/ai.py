"""Pydantic DTOs for AI endpoints (no table backing)."""

from datetime import datetime

from pydantic import BaseModel


class EmbedRequest(BaseModel):
    """Request body for POST /api/v1/embed."""

    text: str


class EmbedResponse(BaseModel):
    """Response body for POST /api/v1/embed: a 1024-dim embedding vector."""

    embedding: list[float]


class RecommendationRequest(BaseModel):
    """Request body for POST /api/v1/sessions/{session_id}/recommendations."""

    force_partial: bool = False


class RecommendationItemOut(BaseModel):
    """A single ranked restaurant pick within a recommendation."""

    restaurant_id: int
    match_score: float | None
    justification: str | None
    name: str | None = None


class RecommendationOut(BaseModel):
    """Response body: a persisted group recommendation with its ranked items."""

    id: int
    session_id: int
    created_at: datetime
    items: list[RecommendationItemOut]
