"""AI endpoints: POST /embed and POST /sessions/{id}/recommendations."""

from fastapi import APIRouter, Depends, HTTPException, status
from openai import APIConnectionError, APITimeoutError

from app.ai.rag.embeddings import embed_text
from app.api.deps import require_internal_secret
from app.schemas.ai import (
    AnalyzeRequest,
    AnalyzeResponse,
    EmbedRequest,
    EmbedResponse,
    RecommendationOut,
    RecommendationRequest,
)
from app.services import recommendation_service, session_service

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


async def _run_analyze(
    payload: AnalyzeRequest, *, session_id: int | None
) -> AnalyzeResponse:
    """Delegate to session_service.analyze_member_turn with shared error mapping.

    Transport/TLS failures from the LLM gateway are mapped to 502 (same reasoning
    as create_recommendation: openai wraps them in APIConnection/APITimeoutError,
    which don't subclass OSError). Note that analyze_turn already degrades
    gracefully on a parseable-but-empty LLM response, so a 502 here means the
    upstream call itself failed, not that parsing did.
    """
    try:
        result = await session_service.analyze_member_turn(
            payload, session_id=session_id
        )
    except HTTPException:
        raise
    except (
        APIConnectionError,
        APITimeoutError,
        ConnectionError,
        TimeoutError,
        OSError,
    ) as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Upstream LLM service failed: {exc}",
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to analyze turn: {exc}",
        ) from exc

    return AnalyzeResponse(**result)


@router.post(
    "/sessions/{session_id}/analyze",
    response_model=AnalyzeResponse,
    dependencies=[Depends(require_internal_secret)],
)
async def analyze_session_turn(
    session_id: int,
    payload: AnalyzeRequest,
) -> AnalyzeResponse:
    """Parse one member's conversational turn within a session (QA sub-agent).

    Extracts/updates the structured signal set (reconciling corrections against
    prior signals) and persists ONLY that member's session-scoped Qa row — their
    temporary override for this event. The durable Profile is never written on a
    session turn (it is read elsewhere purely as the fallback). occasion is
    captured only when the caller is the session host. Returns the reconciled
    signals + a confirm-then-ask agent reply + still-missing signals.
    """
    return await _run_analyze(payload, session_id=session_id)


@router.post(
    "/analyze",
    response_model=AnalyzeResponse,
    dependencies=[Depends(require_internal_secret)],
)
async def analyze_profile_turn(payload: AnalyzeRequest) -> AnalyzeResponse:
    """Parse a profile-edit turn outside any session (session_id is null).

    Same parse + reply as the session variant, but Qa is skipped (no session);
    only the durable Profile diff is persisted/returned.
    """
    return await _run_analyze(payload, session_id=None)
