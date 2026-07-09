"""LangGraph StateGraph: fan-out preference nodes -> group orchestrator node."""

from __future__ import annotations

from typing import Any

from langgraph.graph import END, START, StateGraph
from langgraph.graph.state import CompiledStateGraph
from langgraph.types import Send

from app.ai.agents.orchestrator_agent import orchestrate
from app.ai.agents.preference_agent import normalize_member
from app.ai.graph.state import MemberPref, PipelineState, QaSignals
from app.crud import session as session_crud
from app.db.session import async_session_factory


async def _preference_node(payload: dict[str, Any]) -> dict[str, Any]:
    """Normalize one member's Profile and return a single-element `members` list.

    Runs once per `Send` fan-out. The additive reducer on PipelineState.members
    merges these single-element lists back into one list at convergence.
    """
    member = await normalize_member(payload["profile"])
    return {"members": [member]}


def _fan_out_members(state: PipelineState) -> list[Send]:
    """Route to one `preference` node per raw profile carried in state.

    Reads `state.raw_profiles` (populated by run_pipeline). If there are none,
    returns an empty fan-out and the graph falls straight through to the
    orchestrator, which then produces empty candidates/ranked.
    """
    return [
        Send("preference", {"profile": profile})
        for profile in state.raw_profiles
    ]


async def _orchestrator_node(state: PipelineState) -> dict[str, Any]:
    """Run the group orchestrator and return the fields it produced."""
    result = await orchestrate(state)
    return {
        "reconciled": result.reconciled,
        "candidates": result.candidates,
        "ranked": result.ranked,
    }


def build_graph() -> CompiledStateGraph:
    """Build and compile the preference -> orchestrator StateGraph."""
    graph = StateGraph(PipelineState)
    graph.add_node("preference", _preference_node)
    graph.add_node("orchestrator", _orchestrator_node)

    # Fan out from START to one preference node per member, then converge.
    graph.add_conditional_edges(START, _fan_out_members, ["preference"])
    graph.add_edge("preference", "orchestrator")
    graph.add_edge("orchestrator", END)
    return graph.compile()


async def run_pipeline(
    session_id: int, *, force_partial: bool = False
) -> PipelineState:
    """Load session data via crud, run the compiled graph, return final state.

    `force_partial` is accepted for symmetry with the service entry point; the
    confirmed-members guard lives in the service layer, so this loads whatever
    members exist and lets the pipeline run over them.
    """
    async with async_session_factory() as db:
        members = await session_crud.list_members(db, session_id)
        user_ids = [m.user_id for m in members]
        profiles = await session_crud.get_profiles_for_users(db, user_ids)
        qa_row = await session_crud.get_qa(db, session_id)

    # Flatten Profile rows to plain dicts so they travel cleanly through the
    # graph state (raw_profiles is typed list[dict]).
    raw_profiles: list[dict[str, Any]] = [
        {
            "user_id": p.user_id,
            "dietary_restrictions": list(p.dietary_restrictions or []),
            "preferred_cuisines": list(p.preferred_cuisines or []),
            "disliked_cuisines": list(p.disliked_cuisines or []),
            "budget_min": p.budget_min,
            "budget_max": p.budget_max,
            "liked_restaurant_ids": list(p.liked_restaurant_ids or []),
        }
        for p in profiles
    ]

    qa = (
        QaSignals(
            occasion=qa_row.occasion,
            location_mode=qa_row.location_mode,
            location_lat=qa_row.location_lat,
            location_lon=qa_row.location_lon,
            radius_miles=qa_row.radius_miles,
            time_slot=qa_row.time_slot,
            budget_min=qa_row.budget_min,
            budget_max=qa_row.budget_max,
        )
        if qa_row is not None
        else QaSignals()
    )

    state = PipelineState(session_id=session_id, qa=qa, raw_profiles=raw_profiles)

    compiled = build_graph()
    final = await compiled.ainvoke(state)
    # ainvoke returns a state dict in LangGraph 1.x; normalize back to the model.
    if isinstance(final, dict):
        return PipelineState.model_validate(final)
    return final


__all__ = ["MemberPref", "PipelineState", "build_graph", "run_pipeline"]
