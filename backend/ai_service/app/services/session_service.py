"""Session create/join and status transitions."""

from __future__ import annotations

from typing import Any

from app.ai.agents.conversation_agent import analyze_turn
from app.crud import session as session_crud
from app.db.session import async_session_factory
from app.schemas.ai import AnalyzeRequest
from app.services import profile_service


async def analyze_member_turn(
    payload: AnalyzeRequest, *, session_id: int | None
) -> dict[str, Any]:
    """Parse one QA sub-agent turn, reconcile, persist per ownership rules, return.

    Workflow (mirrors recommendation_service's load -> compute -> persist shape):
      1. Resolve the caller's role for this session: is_host = (the session's
         host_user_id == payload.user_id). Only the host may set the event-level
         occasion; a member's turn never captures or writes it.
      2. Run the conversational agent (LLM parse + reconcile against prior
         signals; graceful degradation is handled inside analyze_turn), passing
         is_host so it asks the host-only questions of the host alone.
      3. IN A SESSION (session_id present): persist ONLY the member's session-
         scoped Qa row (their temporary override for this event) — the durable
         Profile is deliberately NOT written, so a session's answers never mutate
         a user's saved preferences. The Profile is read elsewhere (the pipeline)
         purely as the fallback when the member did not override a field.
      4. OUTSIDE A SESSION (session_id is None — the /analyze profile-edit turn):
         no Qa exists, so persist the durable Profile diff when
         payload.persist_profile is set. This keeps the profile-editor path
         working while the in-session sub-agent stays read-only on Profile.
      5. Return the full DTO-ready dict — extracted_signals + reply + missing +
         what was actually written — regardless of whether persistence ran.

    The returned dict maps 1:1 onto schemas.ai.AnalyzeResponse.
    """
    # Resolve host role from the DB (never trust a client-supplied flag). Only a
    # real session with a matching host_user_id makes this member the host. Also
    # read the host's chosen location so a NON-host member's agent can frame its
    # location question relative to it ("the host set downtown SF — want a spot
    # closer to you?").
    is_host = False
    host_location_label: str | None = None
    if session_id is not None:
        async with async_session_factory() as db:
            session = await session_crud.get_session(db, session_id)
            if session is not None:
                if session.host_user_id == payload.user_id:
                    is_host = True
                else:
                    host_qa = await session_crud.get_qa_for_user(
                        db, session_id, session.host_user_id
                    )
                    if host_qa is not None:
                        host_location_label = host_qa.location_address

    result = await analyze_turn(
        payload.message,
        current_signals=payload.current_signals,
        message_source=payload.message_source,
        conversation_history=payload.conversation_history,
        is_host=is_host,
        host_location_label=host_location_label,
    )

    qa_updated = False
    profile_updated = False
    if session_id is not None:
        # In-session turn: write ONLY the member's Qa override; never the Profile.
        qa_updated = await profile_service.persist_qa(
            session_id, payload.user_id, result.signals, is_host=is_host
        )
    elif payload.persist_profile:
        # Profile-edit turn outside any session: durable Profile write is allowed.
        profile_updated = await profile_service.persist_profile(
            payload.user_id, result.signals
        )

    return {
        "user_id": payload.user_id,
        "session_id": session_id,
        "extracted_signals": result.signals,
        "profile_updated": profile_updated,
        "qa_updated": qa_updated,
        "agent_reply": result.agent_reply,
        "missing_signals": result.missing_signals,
    }
