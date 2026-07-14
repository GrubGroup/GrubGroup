"""Merge extracted signals into persisted preferences."""

from __future__ import annotations

from app.crud import session as session_crud
from app.crud import user as user_crud
from app.db.session import async_session_factory
from app.schemas.ai import ExtractedSignals

# Which ExtractedSignals fields are durable per-user prefs (-> Profile) vs
# session-scoped signals (-> Qa). The split mirrors the two tables the
# orchestrator reads (MemberPref columns live on Profile; QaSignals on Qa).
_PROFILE_LIST_FIELDS = (
    "dietary_restrictions",
    "preferred_cuisines",
    "disliked_cuisines",
)
_PROFILE_SCALAR_FIELDS = ("budget_min", "budget_max")
# Session-scoped Qa fields. Cuisines live here too: on a SESSION turn the
# extracted cuisines are the member's temporary override and are written to
# their Qa row (the Profile is deliberately not touched — see
# session_service.analyze_member_turn). occasion / time_slot are carried through
# but host-gated at the CRUD layer, so a non-host's values are dropped there.
_QA_LIST_FIELDS = (
    "preferred_cuisines",
    "disliked_cuisines",
)
_QA_FIELDS = (
    "preferred_cuisines",
    "disliked_cuisines",
    "occasion",
    "location_mode",
    "location_lat",
    "location_lon",
    "radius_miles",
    "time_slot",
    "budget_min",
    "budget_max",
)


def profile_diff(signals: ExtractedSignals) -> dict:
    """Extract the durable Profile-bound fields from a signal set.

    Lists are always included (they carry the full reconciled list, so a
    correction that dropped a tag is represented). Scalars are included only when
    set, so an unspoken budget never overwrites a stored one.
    """
    diff: dict = {}
    for field in _PROFILE_LIST_FIELDS:
        diff[field] = list(getattr(signals, field) or [])
    for field in _PROFILE_SCALAR_FIELDS:
        value = getattr(signals, field)
        if value is not None:
            diff[field] = value
    return diff


def qa_diff(signals: ExtractedSignals) -> dict:
    """Extract the session-scoped Qa-bound fields from a signal set.

    Cuisine lists carry the FULL reconciled list (so a correction that dropped a
    tag is represented), matching profile_diff's list handling. Scalars are
    included only when set, so an unspoken budget/location never overwrites a
    stored one. Host-only occasion/time_slot pass through here; the CRUD layer
    drops them for a non-host.
    """
    diff: dict = {}
    for field in _QA_LIST_FIELDS:
        diff[field] = list(getattr(signals, field) or [])
    for field in _QA_FIELDS:
        if field in _QA_LIST_FIELDS:
            continue
        value = getattr(signals, field)
        if value is not None:
            diff[field] = value
    return diff


async def persist_profile(user_id: int, signals: ExtractedSignals) -> bool:
    """Merge durable signals into the user's Profile row; return True if written.

    Returns False when the user has no Profile row yet — ai_service does not
    create Profiles (the gateway/Better-Auth path owns that). The caller still
    returns the diff in the response so the gateway can persist it.
    """
    diff = profile_diff(signals)
    async with async_session_factory() as db:
        profile = await user_crud.upsert_profile_signals(db, user_id, diff)
    return profile is not None


async def persist_qa(
    session_id: int,
    user_id: int,
    signals: ExtractedSignals,
    *,
    is_host: bool = False,
) -> bool:
    """Write this member's session-scoped signals onto their Qa row; return True.

    Always writes (get-or-create per (session, member)): a session turn's Qa
    snapshot is AI-produced, session-lifecycle data — the same ownership footing
    as the Recommendation rows ai_service already writes. `is_host` gates the
    host-only occasion / time_slot fields at the CRUD layer.
    """
    async with async_session_factory() as db:
        await session_crud.upsert_qa_signals(
            db, session_id, user_id, qa_diff(signals), is_host=is_host
        )
    return True
