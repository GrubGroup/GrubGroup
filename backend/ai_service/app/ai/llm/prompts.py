"""Prompt templates: optional preference normalization and group re-rank."""

import json
from typing import Any

# --- Optional per-member preference normalization -----------------------------
# The preference agent is deterministic by default (structured Profile straight
# from the DB). This cheap-LLM enrichment prompt exists only as an off-by-default
# hook for turning free-text preference notes into the MemberPref field shape.
PREFERENCE_NORMALIZE_SYSTEM = (
    "You normalize a diner's free-text preferences into structured fields. "
    "Return STRICT JSON with keys: dietary_restrictions (list[str]), "
    "preferred_cuisines (list[str]), disliked_cuisines (list[str]). "
    "Use lowercase single-word tags. Output JSON only, no prose, no code fences."
)


def build_preference_normalize_messages(raw_text: str) -> list[dict[str, Any]]:
    """Build chat messages for optional free-text -> MemberPref-field extraction."""
    return [
        {"role": "system", "content": PREFERENCE_NORMALIZE_SYSTEM},
        {"role": "user", "content": raw_text},
    ]


# --- Group re-rank -----------------------------------------------------------
GROUP_RERANK_SYSTEM = (
    "You are the group restaurant orchestrator for a shared dining session. "
    "You are given reconciled GROUP CONSTRAINTS and a list of CANDIDATE "
    "restaurants that already passed hard filters (dietary, price, distance). "
    "Rank the candidates for how well they satisfy the WHOLE group, balancing "
    "preferred cuisines (reward), disliked cuisines (penalize), rating, price "
    "fit, and proximity.\n\n"
    "Return STRICT JSON only: a JSON array where each element is an object with "
    "exactly these keys:\n"
    '  "restaurant_id" (int, must be one of the candidate ids),\n'
    '  "match_score" (float between 0.0 and 1.0),\n'
    '  "justification" (string, <= 240 characters, one sentence on why it fits '
    "the group).\n"
    "Include every candidate exactly once, best first. Do NOT invent "
    "restaurant ids. Output the JSON array only — no prose, no markdown, no "
    "code fences."
)


def build_group_rerank_messages(
    reconciled: dict[str, Any],
    candidates: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """Build chat messages for the group re-rank step.

    `reconciled` is the ReconciledConstraints payload and `candidates` is the
    list of CandidateRestaurant payloads; both are serialized as JSON so the
    model sees exact ids and tags to score against.
    """
    user_content = (
        "GROUP CONSTRAINTS:\n"
        f"{json.dumps(reconciled, ensure_ascii=False)}\n\n"
        "CANDIDATES:\n"
        f"{json.dumps(candidates, ensure_ascii=False)}\n\n"
        "Rank all candidates now and return the strict JSON array."
    )
    return [
        {"role": "system", "content": GROUP_RERANK_SYSTEM},
        {"role": "user", "content": user_content},
    ]
