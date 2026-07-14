"""Conversational preference sub-agent: LLM parse + reconcile + agent reply.

This is the non-deterministic sibling of ``preference_agent.normalize_member``
(which stays deterministic, copying structured Profile columns). ``analyze_turn``
drives one turn of the per-member QA conversation: it reads the new message in
the context of prior turns + already-known signals, extracts/updates the full
signal set (including budget / occasion / location / time), handles corrections
against the prior signals, and produces a natural-language reply that confirms
what was captured and asks the next missing question.

It degrades gracefully: on any parse/transport failure it returns the prior
signals unchanged plus a safe reply, so a flaky LLM never turns a turn into a
500 (the endpoint layer still maps genuine transport errors to 502).
"""

from __future__ import annotations

import json
from typing import Any

from app.ai.llm.client import chat_completion
from app.ai.llm.prompts import build_preference_turn_messages
from app.schemas.ai import ConversationTurn, ExtractedSignals

# The signal names the reply logic can ask about, in the order we prefer to ask.
_MISSING_ORDER = [
    "dietary_restrictions",
    "preferred_cuisines",
    "budget",
    "occasion",
    "location",
    "time_slot",
]

# occasion + time_slot describe the EVENT and are set by the host only. A
# non-host's sub-agent never asks about them, never reports them missing, and
# never writes them (see _ask_order / _reconcile).
_HOST_ONLY_SIGNALS = {"occasion", "time_slot"}

_VALID_LOCATION_MODES = {"named", "realtime", "unset"}


def _ask_order(is_host: bool) -> list[str]:
    """The signals this member's agent may ask about, in ask-order.

    Hosts get the full set; non-hosts drop the host-only event signals so they
    are never prompted for (or told they're missing) the occasion/time.
    """
    if is_host:
        return _MISSING_ORDER
    return [name for name in _MISSING_ORDER if name not in _HOST_ONLY_SIGNALS]


class TurnResult:
    """Structured output of one conversational turn.

    Not a Pydantic model on purpose — the service maps this straight onto the
    AnalyzeResponse DTO. Carries the fully-reconciled signal set, the agent's
    natural-language reply, and which signals are still missing.
    """

    def __init__(
        self,
        *,
        signals: ExtractedSignals,
        agent_reply: str,
        missing_signals: list[str],
        degraded: bool = False,
    ) -> None:
        self.signals = signals
        self.agent_reply = agent_reply
        self.missing_signals = missing_signals
        # True when the LLM output was unusable and we fell back to prior signals.
        self.degraded = degraded


def _strip_json_fence(raw: str) -> str:
    """Strip markdown code fences so json.loads sees a bare JSON payload.

    Mirrors orchestrator_agent._strip_json_fence — the Salesforce/Claude gateway
    does not honor OpenAI JSON mode, so we prompt for strict JSON and strip
    fences here rather than relying on response_format.
    """
    text = raw.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[-1] if "\n" in text else text
        if text.endswith("```"):
            text = text[: -len("```")]
        if text.lstrip().lower().startswith("json"):
            text = text.lstrip()[len("json"):]
    return text.strip()


def _clean_tags(value: Any) -> list[str] | None:
    """Coerce a value into a deduped list of lowercase single-word tags, or None.

    Returns None when the model omitted the field (so we carry the prior value
    through); returns [] when the model explicitly cleared it.
    """
    if value is None:
        return None
    if not isinstance(value, list):
        return None
    out: list[str] = []
    for item in value:
        # Normalize to the catalog's lowercase underscore tag style (e.g.
        # "gluten free" / "gluten-free" -> "gluten_free"), collapsing spaces and
        # hyphens so tags line up with the retriever's superset filter vocabulary.
        tag = "_".join(str(item).strip().lower().replace("-", " ").split())
        if tag and tag not in out:
            out.append(tag)
    return out


def _coerce_int(value: Any) -> int | None:
    """Best-effort parse of a whole-dollar budget value, or None."""
    if value is None or isinstance(value, bool):
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _reconcile(
    prior: ExtractedSignals, parsed: dict[str, Any], *, is_host: bool
) -> ExtractedSignals:
    """Merge the LLM's updated signals over the prior set, field by field.

    The prompt asks the model to return the FULL updated set (prior + this turn,
    with corrections applied), so a list it returns REPLACES the prior list —
    that is how a correction drops a stale tag. Fields the model omits are
    carried through from `prior`. Scalars are only overwritten when the model
    supplies a non-null value, so a partial turn never nulls out earlier answers.
    occasion / time_slot are HOST-ONLY: for a non-host they are never taken from
    the parse (defense-in-depth on top of the prompt not asking), so a defiant
    non-host still cannot set the event's occasion or timing.
    """
    signals = prior.model_copy(deep=True)

    for field in ("dietary_restrictions", "preferred_cuisines", "disliked_cuisines"):
        cleaned = _clean_tags(parsed.get(field))
        if cleaned is not None:
            setattr(signals, field, cleaned)

    bmin = _coerce_int(parsed.get("budget_min"))
    if bmin is not None:
        signals.budget_min = bmin
    bmax = _coerce_int(parsed.get("budget_max"))
    if bmax is not None:
        signals.budget_max = bmax

    # location_label is always allowed; occasion/time_slot only for the host.
    text_fields = ["location_label"]
    if is_host:
        text_fields += ["occasion", "time_slot"]
    for field in text_fields:
        value = parsed.get(field)
        if isinstance(value, str) and value.strip():
            setattr(signals, field, value.strip())

    mode = parsed.get("location_mode")
    if isinstance(mode, str) and mode.strip().lower() in _VALID_LOCATION_MODES:
        signals.location_mode = mode.strip().lower()  # type: ignore[assignment]

    for field in ("location_lat", "location_lon", "radius_miles"):
        value = parsed.get(field)
        if isinstance(value, (int, float)) and not isinstance(value, bool):
            setattr(signals, field, float(value))

    return signals


def _compute_missing(signals: ExtractedSignals, *, is_host: bool) -> list[str]:
    """Local fallback for which core signals are still unknown, in ask-order.

    Used when the LLM's own missing_signals list is absent/unusable, and to keep
    the reply logic honest. A budget counts as present if either bound is set;
    location counts as present once a mode is chosen. Non-hosts never see the
    host-only occasion/time_slot signals in the ask-order, so those are never
    reported missing for them.
    """
    present: dict[str, bool] = {
        "dietary_restrictions": bool(signals.dietary_restrictions),
        "preferred_cuisines": bool(signals.preferred_cuisines),
        "budget": signals.budget_min is not None or signals.budget_max is not None,
        "occasion": bool(signals.occasion),
        "location": signals.location_mode is not None,
        "time_slot": bool(signals.time_slot),
    }
    return [name for name in _ask_order(is_host) if not present[name]]


def _clean_missing(value: Any, signals: ExtractedSignals, *, is_host: bool) -> list[str]:
    """Validate the model's missing_signals, falling back to the local compute."""
    order = _ask_order(is_host)
    if isinstance(value, list):
        allowed = set(order)
        out = [str(v).strip() for v in value if str(v).strip() in allowed]
        # Preserve our canonical ask-order (and drop host-only names for members).
        return [name for name in order if name in out]
    return _compute_missing(signals, is_host=is_host)


_QUESTION_FOR = {
    "dietary_restrictions": "Any dietary needs I should lock in?",
    "preferred_cuisines": "What kind of food are you in the mood for?",
    "budget": "What is your budget per person?",
    "occasion": "What is the occasion?",
    "location": "Where are you looking to eat?",
    "time_slot": "When are you thinking?",
}


# Appended to a non-host's reply when they tried to set a host-only event field,
# so they learn why it didn't take (the host owns the occasion + timing).
_NON_HOST_NUDGE = (
    " Just so you know, only the host sets the occasion and timing for this "
    "event, so I've left those to them."
)


def _non_host_touched_host_field(parsed: dict[str, Any]) -> bool:
    """True if a non-host's parsed turn tried to set occasion or time_slot."""
    for field in ("occasion", "time_slot"):
        value = parsed.get(field)
        if isinstance(value, str) and value.strip():
            return True
    return False


def _fallback_reply(signals: ExtractedSignals, missing: list[str]) -> str:
    """Deterministic reply used only when the LLM's own reply is unusable.

    Confirms whatever is now captured and asks the next missing question — the
    same confirm-then-ask shape the prompt requests, so a degraded turn still
    behaves correctly for the user.
    """
    bits: list[str] = []
    if signals.disliked_cuisines:
        bits.append(f"you don't like {', '.join(signals.disliked_cuisines)} food")
    if signals.preferred_cuisines:
        bits.append(f"you're into {', '.join(signals.preferred_cuisines)}")
    if signals.dietary_restrictions:
        bits.append(f"dietary: {', '.join(signals.dietary_restrictions)}")
    if signals.budget_max is not None:
        bits.append(f"budget up to ${signals.budget_max}")
    elif signals.budget_min is not None:
        bits.append(f"budget from ${signals.budget_min}")

    confirm = f"Got it, {'; '.join(bits)}." if bits else "Got it."
    if missing:
        return f"{confirm} {_QUESTION_FOR.get(missing[0], 'What else matters to you?')}"
    return f"{confirm} That's everything I need — thanks!"


async def analyze_turn(
    message: str,
    *,
    current_signals: ExtractedSignals | None = None,
    message_source: str = "text",
    conversation_history: list[ConversationTurn] | None = None,
    is_host: bool = False,
) -> TurnResult:
    """Parse one conversational turn into reconciled signals + an agent reply.

    Sends the new message plus prior signals/history to the LLM (no JSON mode —
    strict-JSON prompt + local fence strip), reconciles the parsed signals over
    the prior set (corrections replace lists; partial turns carry the rest
    through), and returns the updated ExtractedSignals, a confirm-then-ask reply,
    and the still-missing signals. `is_host` gates the event-level signals: only
    the host is asked about (and can set) occasion / time_slot — a non-host is
    never prompted for them, never has them extracted, and is gently told the
    host owns them if they try. On any LLM/parse failure it degrades to the prior
    signals + a safe deterministic reply (TurnResult.degraded == True).
    """
    prior = current_signals or ExtractedSignals()
    history = [t.model_dump() for t in (conversation_history or [])]

    messages = build_preference_turn_messages(
        message,
        message_source=message_source,
        conversation_history=history,
        current_signals=prior.model_dump(),
        is_host=is_host,
    )

    # NOTE: do NOT pass response_format={"type": "json_object"} — the active
    # Salesforce/Claude gateway ignores it and returns an empty "{}". The prompt
    # demands strict JSON and we strip fences below (same pattern as the re-rank).
    raw = await chat_completion(messages, temperature=0.2) or ""

    try:
        parsed = json.loads(_strip_json_fence(raw))
    except (ValueError, TypeError):
        parsed = None

    if not isinstance(parsed, dict):
        missing = _compute_missing(prior, is_host=is_host)
        return TurnResult(
            signals=prior,
            agent_reply=_fallback_reply(prior, missing),
            missing_signals=missing,
            degraded=True,
        )

    raw_signals = parsed.get("extracted_signals")
    if not isinstance(raw_signals, dict):
        # Tolerate a model that put the signal fields at the top level.
        raw_signals = parsed

    signals = _reconcile(prior, raw_signals, is_host=is_host)
    missing = _clean_missing(parsed.get("missing_signals"), signals, is_host=is_host)

    reply = parsed.get("agent_reply")
    if not (isinstance(reply, str) and reply.strip()):
        reply = _fallback_reply(signals, missing)
    else:
        reply = reply.strip()

    # If a non-host tried to set the host-only event fields, append a short note
    # so they understand why it didn't take (belt-and-suspenders: the prompt
    # already tells the model not to, and _reconcile dropped the values).
    if not is_host and _non_host_touched_host_field(raw_signals):
        reply = f"{reply}{_NON_HOST_NUDGE}"

    return TurnResult(
        signals=signals,
        agent_reply=reply,
        missing_signals=missing,
    )
