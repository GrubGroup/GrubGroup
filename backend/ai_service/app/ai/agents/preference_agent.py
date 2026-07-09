"""Per-member preference agent: normalize a Profile row into a MemberPref."""

from __future__ import annotations

from typing import Any

from app.ai.graph.state import MemberPref


def _get(profile: Any, key: str, default: Any) -> Any:
    """Read `key` from either a Profile-like object or a plain dict."""
    if isinstance(profile, dict):
        return profile.get(key, default)
    return getattr(profile, key, default)


async def normalize_member(
    profile: Any, *, enrich: bool = False
) -> MemberPref:
    """Normalize a Profile-like object (or dict) into a MemberPref.

    Deterministic by default: the structured Profile columns are copied straight
    through. `enrich=True` is an off-by-default hook that could route free-text
    preference notes through a cheap LLM (see prompts.build_preference_normalize_
    messages); no free-text column exists in the schema today, so it is a no-op
    layered on top of the deterministic result.
    """
    member = MemberPref(
        user_id=_get(profile, "user_id", 0),
        dietary_restrictions=list(_get(profile, "dietary_restrictions", []) or []),
        preferred_cuisines=list(_get(profile, "preferred_cuisines", []) or []),
        disliked_cuisines=list(_get(profile, "disliked_cuisines", []) or []),
        budget_min=_get(profile, "budget_min", 0) or 0,
        budget_max=_get(profile, "budget_max", 0) or 0,
        liked_restaurant_ids=list(_get(profile, "liked_restaurant_ids", []) or []),
    )

    if enrich:
        # Reserved cheap-LLM enrichment hook. Intentionally inert until a
        # free-text preference field exists on Profile; when it does, extract
        # extra tags here via chat_completion + build_preference_normalize_messages
        # and merge them into `member`.
        pass

    return member
