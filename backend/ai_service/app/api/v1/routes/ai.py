"""AI endpoints: POST /embed (and future analyze/recommendations)."""

from fastapi import APIRouter, Depends, HTTPException, status

from app.ai.rag.embeddings import embed_text
from app.api.deps import require_internal_secret
from app.schemas.ai import EmbedRequest, EmbedResponse

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
