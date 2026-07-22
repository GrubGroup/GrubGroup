"""Group recommendation workflow: guard, run pipeline, persist, shape response."""

from __future__ import annotations

from typing import Any

from app.ai.graph.pipeline import run_pipeline
from app.crud import recommendation as recommendation_crud
from app.crud import session as session_crud
from app.db.session import async_session_factory


class SessionNotReadyError(ValueError):
    """Raised when a recommendation is requested before all members confirmed."""


async def generate_recommendation(
    session_id: int, *, force_partial: bool = False
) -> dict[str, Any]:
    """Generate, persist, and return a group recommendation for a session.

    Unless `force_partial` is set, this guards that every session member has
    confirmed (crud.session.all_members_confirmed) and raises
    SessionNotReadyError otherwise. It then runs the LangGraph pipeline, persists
    the ranked picks via crud.recommendation, and returns a DTO-ready dict:
    {recommendation_id, session_id, created_at, items:[{restaurant_id,
    match_score, justification, name, hours, is_open}, ...]}.

    The persisted RecommendationItem row keeps only restaurant_id / match_score /
    justification; `name` / `hours` / `is_open` are enriched from the pipeline
    candidates for the response (so the picks payload is self-contained when the
    gateway delivers it into the group chat), not stored.
    """
    if not force_partial:
        async with async_session_factory() as db:
            ready = await session_crud.all_members_confirmed(db, session_id)
        if not ready:
            raise SessionNotReadyError(
                f"Session {session_id} is not ready: not all members have confirmed. "
                "Pass force_partial=True to recommend anyway."
            )

    state = await run_pipeline(session_id, force_partial=force_partial)

    # Index the pipeline candidates by id for the response enrichment (name /
    # hours / open-at-event-time). These are display fields, not persisted.
    candidate_by_id = {c.id: c for c in state.candidates}

    persist_items = [
        {
            "restaurant_id": item.restaurant_id,
            "match_score": item.match_score,
            "justification": item.justification,
        }
        for item in state.ranked
    ]

    async with async_session_factory() as db:
        recommendation = await recommendation_crud.create_recommendation(
            db, session_id
        )
        await recommendation_crud.add_items(db, recommendation.id, persist_items)

    items = []
    for item in state.ranked:
        candidate = candidate_by_id.get(item.restaurant_id)
        items.append(
            {
                "restaurant_id": item.restaurant_id,
                "match_score": item.match_score,
                "justification": item.justification,
                "name": candidate.name if candidate else None,
                "hours": candidate.hours if candidate else None,
                "is_open": candidate.is_open if candidate else None,
            }
        )

    return {
        "recommendation_id": recommendation.id,
        "session_id": session_id,
        "created_at": recommendation.created_at,
        "items": items,
    }
