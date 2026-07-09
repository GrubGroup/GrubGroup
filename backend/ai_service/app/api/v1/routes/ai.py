"""AI endpoints: POST /embed and POST /sessions/{id}/recommendations."""

from fastapi import APIRouter, Depends, HTTPException, status
from openai import APIConnectionError, APITimeoutError

from app.ai.rag.embeddings import embed_text
from app.api.deps import require_internal_secret
from app.schemas.ai import (
    EmbedRequest,
    EmbedResponse,
    RecommendationOut,
    RecommendationRequest,
)
from app.services import recommendation_service

router = APIRouter(tags=["ai"])


@router.post(
    "/embed",
    response_model=EmbedResponse,
    dependencies=[Depends(require_internal_secret)],
)
async def embed(payload: EmbedRequest) -> EmbedResponse:
    """Generate a 1024-dim embedding for the given text via OpenRouter."""
    try:
        embedding = await embed_text(payload.text)
    except Exception as exc:  # surface upstream/dimension failures as 502
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Embedding generation failed: {exc}",
        ) from exc
    return EmbedResponse(embedding=embedding)


@router.post(
    "/sessions/{session_id}/recommendations",
    response_model=RecommendationOut,
    dependencies=[Depends(require_internal_secret)],
)
async def create_recommendation(
    session_id: int,
    payload: RecommendationRequest,
) -> RecommendationOut:
    """Run the orchestrator pipeline and return the persisted group recommendation."""
    try:
        result = await recommendation_service.generate_recommendation(
            session_id, force_partial=payload.force_partial
        )
    except recommendation_service.SessionNotReadyError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        ) from exc
    except HTTPException:
        raise
    except (
        APIConnectionError,
        APITimeoutError,
        ConnectionError,
        TimeoutError,
        OSError,
    ) as exc:
        # openai wraps transport/TLS failures (e.g. a Salesforce-gateway cert or
        # connection error) in APIConnectionError/APITimeoutError, which do NOT
        # subclass ConnectionError/OSError — so they must be caught explicitly to
        # map to 502 (upstream failure) rather than falling through to 500.
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Upstream LLM/embedding service failed: {exc}",
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate recommendation: {exc}",
        ) from exc

    return RecommendationOut(
        id=result["recommendation_id"],
        session_id=result["session_id"],
        created_at=result["created_at"],
        items=result["items"],
    )
