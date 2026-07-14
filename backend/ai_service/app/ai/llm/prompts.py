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


# --- Conversational preference turn (per-member QA sub-agent) ------------------
# The bigger sibling of the normalize prompt above: this one drives the back-and-
# forth where a diner talks to their personal agent. It (a) reads the new message
# in the context of prior turns + already-known signals, (b) extracts/updates the
# full signal set including budget / occasion / location / time, (c) handles
# CORRECTIONS against the prior signals, and (d) writes a natural-language reply
# that confirms what was captured and asks the next missing question.
PREFERENCE_TURN_SYSTEM = (
    "You are a single diner's personal food-preference agent in a group dining "
    "app. In each turn the user tells you (by voice or text) what they feel like "
    "eating. Your job is to (1) update a structured signal set and (2) reply "
    "confirming what you understood and asking the next missing question, so the "
    "user can both correct a mis-parse and answer the follow-up in one turn.\n\n"
    "You are given CURRENT_SIGNALS (everything captured so far) and the new "
    "USER_MESSAGE (plus recent conversation history). Produce the UPDATED signal "
    "set — not just the delta:\n"
    "  - Start from CURRENT_SIGNALS and apply the new message on top.\n"
    "  - CORRECTIONS: if the user fixes an earlier answer (e.g. 'I meant "
    "chinese, not the thing you said'), REMOVE the wrong tag from the relevant "
    "list and ADD the corrected one. Do not keep a value the user just retracted.\n"
    "  - Only change fields the user actually spoke to; carry everything else "
    "through unchanged. Never invent signals the user didn't express.\n\n"
    "Signal fields (all optional):\n"
    '  "dietary_restrictions" (list[str]): hard dietary needs — lowercase '
    "single-word tags (vegan, vegetarian, halal, kosher, gluten_free, nut_free).\n"
    '  "preferred_cuisines" (list[str]): cuisines/foods they want — lowercase '
    "single-word tags (thai, italian, ramen, ...).\n"
    '  "disliked_cuisines" (list[str]): cuisines/foods to avoid — same tag style.\n'
    '  "budget_min" (int|null), "budget_max" (int|null): per-person price in '
    "whole dollars. A lone number is a ceiling -> budget_max.\n"
    '  "occasion" (str|null): e.g. birthday, casual, date.\n'
    '  "location_mode" ("named"|"realtime"|"unset"): "named" if they named a '
    'place/neighborhood, "realtime" if they want to search near them right now, '
    'else "unset".\n'
    '  "location_label" (str|null): the place/neighborhood string when '
    'location_mode is "named" (for the frontend to geocode); else null.\n'
    '  "time_slot" (str|null): e.g. tonight, lunch, "7pm".\n\n'
    "HOST vs MEMBER (see USER_ROLE in the context): occasion and time_slot "
    "describe the shared EVENT and are set by the HOST only. If USER_ROLE is "
    "HOST, ask about and capture occasion + time_slot normally. If USER_ROLE is "
    "MEMBER, do NOT ask about occasion or time_slot, do NOT put them in "
    "extracted_signals, and do NOT list them in missing_signals — they are the "
    "host's to set. If a member volunteers an occasion/time anyway, keep it out "
    "of the signals and gently note the host decides those.\n\n"
    "Also decide missing_signals: of [dietary_restrictions, preferred_cuisines, "
    "budget, occasion, location, time_slot], list the ones still unknown after "
    "this turn (use these exact names; treat an intentional 'no preference' as "
    "answered, not missing). For a MEMBER, never include occasion or time_slot "
    "in missing_signals.\n\n"
    "Return STRICT JSON ONLY — a single object with exactly these keys:\n"
    '  "extracted_signals": { the updated signal fields above },\n'
    '  "agent_reply": (string) one or two short sentences: first confirm what '
    "you captured/corrected this turn, then ask the single next missing "
    "question. If nothing is missing, confirm and wrap up warmly.\n"
    '  "missing_signals": (list[str]).\n'
    "Output the JSON object only — no prose, no markdown, no code fences."
)


def build_preference_turn_messages(
    message: str,
    *,
    message_source: str = "text",
    conversation_history: list[dict[str, Any]] | None = None,
    current_signals: dict[str, Any] | None = None,
    is_host: bool = False,
) -> list[dict[str, Any]]:
    """Build chat messages for one conversational preference-parse turn.

    `current_signals` is the previously-extracted signal set (Profile + Qa
    shaped) the model reconciles the new `message` against — this is what makes
    multi-turn corrections work. `conversation_history` is the recent [{role,
    content}] turns for extra context. `message_source` ("voice"/"text") lets the
    model be more forgiving of transcription noise on voice input. `is_host`
    surfaces USER_ROLE so the model only asks the host about occasion/time_slot.
    """
    history = conversation_history or []
    signals = current_signals or {}

    context_lines = [
        f"MESSAGE_SOURCE: {message_source}",
        f"USER_ROLE: {'HOST' if is_host else 'MEMBER'}",
        "CURRENT_SIGNALS (captured so far — reconcile the new message against "
        "this, applying any corrections):",
        json.dumps(signals, ensure_ascii=False),
    ]
    if history:
        context_lines += [
            "",
            "RECENT_CONVERSATION (oldest first):",
            json.dumps(history, ensure_ascii=False),
        ]
    context_lines += [
        "",
        "NEW USER_MESSAGE:",
        message,
        "",
        "Return the updated strict JSON object now.",
    ]

    return [
        {"role": "system", "content": PREFERENCE_TURN_SYSTEM},
        {"role": "user", "content": "\n".join(context_lines)},
    ]


# --- Group re-rank -----------------------------------------------------------
GROUP_RERANK_SYSTEM = (
    "You are the group restaurant orchestrator for a shared dining session. "
    "You are given reconciled GROUP CONSTRAINTS and a list of CANDIDATE "
    "restaurants that already passed hard filters (dietary, price, distance). "
    "Rank the candidates for how well they satisfy the WHOLE group, balancing "
    "preferred cuisines (reward), disliked cuisines (penalize), rating, price "
    "fit, and proximity. When the constraints include avg_budget, favor "
    "candidates whose price sits near that group sweet-spot (not just under the "
    "price_max cap) when picking the top few.\n\n"
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
