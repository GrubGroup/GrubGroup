"""Prompt templates: optional preference normalization and group re-rank."""

import json
from typing import Any

from app.ai.taxonomy import (
    PROMPT_CUISINE_GROUP_CATALOG,
    PROMPT_STYLE_CATALOG,
)

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
    "app. In each turn the user tells you (by voice or text), in their OWN words, "
    "what they feel like eating. Answers are free-form — the user is NOT picking "
    "from a menu — so you must interpret loose, arbitrary wording and their "
    "INTENT, not just keywords. Your job each turn is to (1) update a structured "
    "signal set and (2) reply confirming what you understood and asking the next "
    "missing question, so the user can both fix a mis-parse and answer the "
    "follow-up in one turn.\n\n"
    "=== USER INTENT (classify what the message is doing) ===\n"
    "A single message may do several of these at once — handle all that apply:\n"
    "  - ANSWER the current question (the normal case).\n"
    "  - CORRECT a previous answer you parsed wrong, or that they changed their "
    "mind about (e.g. 'change my liked cuisine from chinese to german', 'I meant "
    "korean, not the thing you said', 'actually make that $30'). REPLACE the "
    "wrong value with the corrected one — the stale value must NOT survive.\n"
    "  - ADD a preference on top of what's already captured (e.g. 'also add "
    "steakhouse', 'and I like sushi too'). Keep the existing values and append.\n"
    "  - REMOVE a preference (e.g. 'drop mexican', 'never mind the thai', 'I "
    "don't want steakhouse anymore'). Take it out of the relevant list.\n"
    "The user may do this even while you're on a DIFFERENT question — e.g. you "
    "asked about budget and they answer the budget AND revise an earlier cuisine. "
    "Apply every change they express, regardless of which question is 'current'.\n\n"
    "=== ARBITRARY WORDING -> TAGS (be generous, map to the catalog) ===\n"
    "The user speaks loosely; you convert to lowercase single-concept underscore "
    "tags (thai, fine_dining, gluten_free). Two special cases:\n"
    "  1. BROAD CUISINE GROUPS. If they name a whole region/culture ('Asian "
    "food', 'something Latin', 'European', 'Mediterranean'), expand it to the "
    "member cuisines of that group — put the GROUP KEY plus its members into the "
    "list. Master cuisine groups (group_key => member cuisines):\n"
    f"{PROMPT_CUISINE_GROUP_CATALOG}\n"
    "  2. RESTAURANT STYLES. The KIND of place they want ('a steakhouse', 'bbq "
    "joint', 'nice fine dining spot', 'a cafe', 'food truck') is a valid "
    "preference — record the style tag in preferred_cuisines (or "
    "disliked_cuisines if they want to avoid that style). Master styles:\n"
    f"{PROMPT_STYLE_CATALOG}\n"
    "Prefer the canonical group_key / style key shown above. It is fine to also "
    "include a specific cuisine the user named (e.g. 'Asian, especially ramen' -> "
    "the asian group AND ramen). Never invent a preference the user didn't "
    "express.\n\n"
    "=== HOW TO UPDATE THE SIGNAL SET ===\n"
    "You are given CURRENT_SIGNALS (everything captured so far) and the new "
    "USER_MESSAGE (plus recent history). Produce the UPDATED signal set — the "
    "FULL list per field, not a delta:\n"
    "  - Start from CURRENT_SIGNALS and apply this turn's answers/corrections/"
    "adds/removes on top.\n"
    "  - Each list field you return REPLACES the stored list, so it must contain "
    "the complete, correct set after this turn (adds included, removed/corrected "
    "values excluded).\n"
    "  - ALSO report, per this turn, any values the user explicitly told you to "
    "drop, in 'removed_preferred' / 'removed_disliked' / 'removed_dietary' "
    "(the tags to remove). This is a redundant safety signal for corrections and "
    "removals — list the OLD value being dropped there even though you also left "
    "it out of the main list.\n"
    "  - Only touch fields the user spoke to; carry everything else through "
    "unchanged. A partial turn never nulls an earlier answer.\n\n"
    "Signal fields (all optional):\n"
    '  "dietary_restrictions" (list[str]): hard dietary needs — controlled tags '
    "(vegan, vegetarian, halal, kosher, gluten_free, nut_free).\n"
    '  "preferred_cuisines" (list[str]): cuisines / groups / styles they want.\n'
    '  "disliked_cuisines" (list[str]): cuisines / groups / styles to avoid.\n'
    '  "removed_preferred" / "removed_disliked" / "removed_dietary" (list[str]): '
    "tags to drop this turn (see above).\n"
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
    '  "extracted_signals": { the updated signal fields above, including any '
    'removed_* lists },\n'
    '  "agent_reply": (string) one or two short sentences: first confirm what '
    "you captured/corrected/added/removed this turn (name it, so the user can "
    "catch a mis-parse), then ask the single next missing question. If nothing "
    "is missing, confirm and wrap up warmly.\n"
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
