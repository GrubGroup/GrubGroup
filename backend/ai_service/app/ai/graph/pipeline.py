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


def _build_session_signals(
    qa_rows: list[Any], host_user_id: int | None
) -> QaSignals:
    """Reduce per-member Qa rows into the one session-level signal set.

    occasion / time_slot are HOST-ONLY: they are read strictly from the host's
    Qa row (the schema already keeps them null on non-host rows, but reading only
    the host row makes that explicit). The search location is taken from the
    host's row when present, otherwise from the first member who supplied one, so
    a host who skipped location still gets a usable group center.
    """
    host_qa = next(
        (qa for qa in qa_rows if qa.user_id == host_user_id), None
    )

    occasion = host_qa.occasion if host_qa else None
    time_slot = host_qa.time_slot if host_qa else None

    # Prefer the host's location; else fall back to any member's.
    located = None
    if host_qa is not None and host_qa.location_lat is not None:
        located = host_qa
    else:
        located = next((qa for qa in qa_rows if qa.location_lat is not None), None)

    if located is None:
        return QaSignals(occasion=occasion, time_slot=time_slot)

    return QaSignals(
        occasion=occasion,
        time_slot=time_slot,
        location_mode=located.location_mode,
        location_lat=located.location_lat,
        location_lon=located.location_lon,
        radius_miles=located.radius_miles,
    )


async def run_pipeline(
    session_id: int, *, force_partial: bool = False
) -> PipelineState:
    """Load session data via crud, run the compiled graph, return final state.

    `force_partial` is accepted for symmetry with the service entry point; the
    confirmed-members guard lives in the service layer, so this loads whatever
    members exist and lets the pipeline run over them.
    """
    async with async_session_factory() as db:
        session = await session_crud.get_session(db, session_id)
        members = await session_crud.list_members(db, session_id)
        user_ids = [m.user_id for m in members]
        profiles = await session_crud.get_profiles_for_users(db, user_ids)
        qa_rows = await session_crud.list_qa(db, session_id)

    host_user_id = session.host_user_id if session is not None else None
    # Index each member's session-scoped Qa row by user_id (one row per member).
    qa_by_user = {qa.user_id: qa for qa in qa_rows}

    # Flatten Profile rows to plain dicts so they travel cleanly through the
    # graph state (raw_profiles is typed list[dict]). Each member's own Qa row
    # is merged in as qa_* overrides — the durable Profile stays untouched, and
    # a member with no Qa row simply carries empty overrides.
    raw_profiles: list[dict[str, Any]] = []
    for p in profiles:
        member_qa = qa_by_user.get(p.user_id)
        raw_profiles.append(
            {
                "user_id": p.user_id,
                "dietary_restrictions": list(p.dietary_restrictions or []),
                "preferred_cuisines": list(p.preferred_cuisines or []),
                "disliked_cuisines": list(p.disliked_cuisines or []),
                "budget_min": p.budget_min,
                "budget_max": p.budget_max,
                "liked_restaurant_ids": list(p.liked_restaurant_ids or []),
                "qa_preferred_cuisines": (
                    list(member_qa.preferred_cuisines or []) if member_qa else []
                ),
                "qa_disliked_cuisines": (
                    list(member_qa.disliked_cuisines or []) if member_qa else []
                ),
                "qa_budget_min": member_qa.budget_min if member_qa else None,
                "qa_budget_max": member_qa.budget_max if member_qa else None,
            }
        )

    # Session-level (host-authored) signals: occasion / time_slot are host-only,
    # and the group search location comes from the host's Qa row, falling back
    # to any member who supplied one so a host who skipped location still gets a
    # sensible center.
    qa = _build_session_signals(qa_rows, host_user_id)

    state = PipelineState(session_id=session_id, qa=qa, raw_profiles=raw_profiles)

    compiled = build_graph()
    final = await compiled.ainvoke(state)
    # ainvoke returns a state dict in LangGraph 1.x; normalize back to the model.
    if isinstance(final, dict):
        return PipelineState.model_validate(final)
    return final


__all__ = ["MemberPref", "PipelineState", "build_graph", "run_pipeline"]
