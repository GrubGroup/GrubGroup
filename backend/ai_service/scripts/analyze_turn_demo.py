"""Narrated walkthrough of the LLM conversational preference sub-agent (analyze_turn).

This is the validation sibling of ``scripts/demo_orchestrator.py`` for the NEW
non-deterministic turn parser (``app/ai/agents/conversation_agent.analyze_turn``).
It exercises the exact multi-turn correction scenario from the feature spec:

  1. INITIAL PARSE — "I don't like german or mexican food" -> the agent captures
     disliked = [german, mexican] and replies confirming that plus asking the
     next question ("...What is your budget?").
  2. MIS-PARSE — the model mishears and captures a bad tag ("wrong-chinese"),
     replying "Got it, you don't like wrong-chinese food. What is your budget?".
  3. CORRECTION — "I meant to say, I don't like Chinese food. My budget is $20"
     -> the agent REPLACES the bad tag (drops wrong_chinese, adds chinese),
     captures budget_max = 20, and replies confirming the correction + asking the
     next missing question. This proves the reconcile-against-prior-signals path.

Modes (mirrors the demo/interactive scripts' honesty split):

  * DEFAULT (offline): no DB, no API keys, deterministic. The LLM is replaced by
    a scripted stand-in that returns the exact turn responses above, so the REAL
    ``analyze_turn`` reconcile/parse/reply-fallback logic runs end to end without
    any network. Runs anywhere, including CI.
  * ``--live``: calls the REAL Salesforce/Claude gateway for each turn. Needs
    ``SALESFORCE_API_KEY`` (+ optional ``NODE_EXTRA_CA_CERTS``). No DB rows are
    written — this drives the pure parse path, not the persistence service.

Run:
    cd backend/ai_service
    uv run python -m scripts.analyze_turn_demo
    uv run python -m scripts.analyze_turn_demo --live
    uv run python -m scripts.analyze_turn_demo --no-color
"""

from __future__ import annotations

import argparse
import asyncio
import json

import app.ai.agents.conversation_agent as conversation_agent
from app.ai.agents.conversation_agent import analyze_turn
from app.core.config import settings
from app.schemas.ai import ConversationTurn, ExtractedSignals

from scripts.demo_orchestrator import (
    Ink,
    _agent_says,
    _banner,
    _kv,
    _make_ink,
    _note,
    _rule,
    _step,
    _substep,
    _user_says,
)

_MEMBER_NAME = "Alex"

# The three user messages, in order. The mis-parse turn's message is deliberately
# vague so the (offline) model "mishearing" it is plausible.
_TURNS = [
    "I don't like german or mexican food",
    "actually, one more thing about what I don't like",
    "I meant to say, I don't like Chinese food. My budget is $20",
]

# Scripted LLM JSON for the OFFLINE run — these stand in for real completions so
# the REAL analyze_turn parse/reconcile/reply logic runs unchanged. Turn 2
# injects the "wrong-chinese" mis-parse verbatim from the spec; turn 3 returns
# the FULL corrected disliked list (how a correction drops the stale tag).
_OFFLINE_LLM_JSON = [
    json.dumps(
        {
            "extracted_signals": {"disliked_cuisines": ["german", "mexican"]},
            "agent_reply": (
                "Got it, you don't like german or mexican food. "
                "What is your budget?"
            ),
            "missing_signals": [
                "dietary_restrictions",
                "preferred_cuisines",
                "budget",
                "occasion",
                "location",
                "time_slot",
            ],
        }
    ),
    json.dumps(
        {
            "extracted_signals": {"disliked_cuisines": ["wrong-chinese"]},
            "agent_reply": (
                "Got it, you don't like wrong-chinese food. What is your budget?"
            ),
            "missing_signals": [
                "dietary_restrictions",
                "preferred_cuisines",
                "budget",
                "occasion",
                "location",
                "time_slot",
            ],
        }
    ),
    json.dumps(
        {
            "extracted_signals": {
                "disliked_cuisines": ["chinese"],
                "budget_max": 20,
            },
            "agent_reply": (
                "Sorry about the mix-up — noted, you don't like chinese food, "
                "and your budget is up to $20. "
                "What kind of food are you in the mood for?"
            ),
            "missing_signals": [
                "dietary_restrictions",
                "preferred_cuisines",
                "occasion",
                "location",
                "time_slot",
            ],
        }
    ),
]


def _install_offline_llm() -> None:
    """Replace chat_completion with a scripted stand-in for the offline run.

    Patches the name the agent module actually calls, so the real analyze_turn
    (fence-strip, reconcile, reply/missing fallback) executes over canned JSON.
    """
    responses = iter(_OFFLINE_LLM_JSON)

    async def _scripted_completion(messages, **kwargs):  # noqa: ANN001, ARG001
        return next(responses)

    conversation_agent.chat_completion = _scripted_completion


def _print_intro(ink: Ink, live: bool) -> None:
    _banner(ink, "GrubGroup · LLM Preference Sub-Agent — analyze_turn Validation")
    mode = (
        ink.warn("LIVE (real Salesforce/Claude gateway)")
        if live
        else ink.good("OFFLINE (scripted LLM, no DB, no keys, deterministic)")
    )
    print(f"  Mode: {mode}")
    print(
        "  "
        + ink.dim(
            "One member talks to their personal agent. Each turn is parsed into a\n"
            "  structured signal set (Profile + Qa shaped) and reconciled against what\n"
            "  was said before — including a mid-conversation CORRECTION."
        )
    )


def _print_signals(ink: Ink, signals: ExtractedSignals) -> None:
    """Print the reconciled signal set after a turn (only the interesting fields)."""
    _kv(ink, "disliked_cuisines", str(signals.disliked_cuisines))
    _kv(ink, "preferred_cuisines", str(signals.preferred_cuisines))
    _kv(ink, "dietary_restrictions", str(signals.dietary_restrictions))
    bmin = signals.budget_min if signals.budget_min is not None else "-"
    bmax = signals.budget_max if signals.budget_max is not None else "-"
    _kv(ink, "budget (min/max)", f"${bmin} / ${bmax}")


def _check(ink: Ink, label: str, ok: bool) -> bool:
    mark = ink.good("✓ PASS") if ok else ink.warn("✗ FAIL")
    print(f"    {mark}  {label}")
    return ok


async def _run(args: argparse.Namespace) -> int:
    ink = _make_ink(args.no_color)
    _print_intro(ink, args.live)

    if args.live and not settings.salesforce_api_key:
        _note(
            ink,
            "SALESFORCE_API_KEY is empty — --live cannot reach the gateway. Drop "
            "--live for the offline deterministic run.",
        )
        return 0

    if not args.live:
        _install_offline_llm()

    _step(ink, "1/3", "INITIAL PARSE (capture dislikes, confirm + ask next)")
    signals = ExtractedSignals()
    history: list[ConversationTurn] = []

    _user_says(ink, _MEMBER_NAME, _TURNS[0])
    result = await analyze_turn(
        _TURNS[0], current_signals=signals, conversation_history=history
    )
    signals = result.signals
    _print_signals(ink, signals)
    _agent_says(ink, f"{_MEMBER_NAME}'s Agent", result.agent_reply)
    _kv(ink, "missing_signals", str(result.missing_signals))
    history += [
        ConversationTurn(role="user", content=_TURNS[0]),
        ConversationTurn(role="assistant", content=result.agent_reply),
    ]

    _step(ink, "2/3", "MIS-PARSE (agent mishears -> a bad tag)")
    _user_says(ink, _MEMBER_NAME, _TURNS[1])
    result = await analyze_turn(
        _TURNS[1], current_signals=signals, conversation_history=history
    )
    signals = result.signals
    _print_signals(ink, signals)
    _agent_says(ink, f"{_MEMBER_NAME}'s Agent", result.agent_reply)
    if not args.live:
        _note(
            ink,
            "offline scripted mis-parse: the agent captured 'wrong_chinese' (the "
            "kind of transcription/parse error the correction turn must fix).",
        )
    history += [
        ConversationTurn(role="user", content=_TURNS[1]),
        ConversationTurn(role="assistant", content=result.agent_reply),
    ]
    disliked_after_misparse = list(signals.disliked_cuisines)

    _step(ink, "3/3", "CORRECTION (drop the bad tag, add chinese, capture budget)")
    _user_says(ink, _MEMBER_NAME, _TURNS[2])
    result = await analyze_turn(
        _TURNS[2], current_signals=signals, conversation_history=history
    )
    signals = result.signals
    _print_signals(ink, signals)
    _agent_says(ink, f"{_MEMBER_NAME}'s Agent", result.agent_reply)
    _kv(ink, "missing_signals", str(result.missing_signals))

    print()
    _substep(ink, "ASSERTIONS")
    ok = True
    if not args.live:
        # Offline is deterministic — assert the exact spec outcome.
        ok &= _check(
            ink,
            "mis-parse turn captured a bad tag (wrong_chinese present)",
            "wrong_chinese" in disliked_after_misparse,
        )
        ok &= _check(
            ink,
            "correction DROPPED the bad tag (wrong_chinese gone)",
            "wrong_chinese" not in signals.disliked_cuisines,
        )
        ok &= _check(
            ink,
            "correction ADDED chinese (disliked == [chinese])",
            signals.disliked_cuisines == ["chinese"],
        )
        ok &= _check(
            ink,
            "correction captured budget_max == 20",
            signals.budget_max == 20,
        )
        ok &= _check(
            ink,
            "agent produced a non-empty confirm + next-question reply",
            bool(result.agent_reply.strip()),
        )
    else:
        # Live output varies; assert only the invariants the reconcile guarantees.
        ok &= _check(
            ink,
            "correction removed the earlier bad tag",
            "wrong_chinese" not in signals.disliked_cuisines,
        )
        ok &= _check(
            ink,
            "chinese is now in disliked_cuisines",
            "chinese" in signals.disliked_cuisines,
        )
        ok &= _check(
            ink,
            "budget captured (budget_max is set)",
            signals.budget_max is not None,
        )

    _rule(ink)
    if ok:
        print(f"  {ink.good('✔ ALL CHECKS PASSED.')}")
        _print_final_diff(ink, signals)
        return 0
    print(f"  {ink.warn('✖ SOME CHECKS FAILED (see above).')}")
    return 1


def _print_final_diff(ink: Ink, signals: ExtractedSignals) -> None:
    """Show the Profile/Qa-bound diffs the service would persist for this member."""
    from app.services import profile_service

    print()
    print("  " + ink.dim("— what the service would persist —"))
    _kv(ink, "Profile diff", json.dumps(profile_service.profile_diff(signals)))
    _kv(ink, "Qa diff", json.dumps(profile_service.qa_diff(signals)))
    print()


def main() -> None:
    """Parse args and run the analyze_turn validation walkthrough."""
    parser = argparse.ArgumentParser(
        description=(
            "Validate the LLM conversational preference sub-agent (analyze_turn): "
            "initial parse, confirm + next-question reply, and multi-turn "
            "correction. Offline-deterministic by default; --live hits the real "
            "Salesforce/Claude gateway."
        )
    )
    parser.add_argument(
        "--live",
        action="store_true",
        help="Call the real LLM gateway per turn (needs SALESFORCE_API_KEY). "
        "Default is a fully offline deterministic run.",
    )
    parser.add_argument(
        "--no-color",
        action="store_true",
        help="Disable ANSI colors (also auto-disabled when piped or NO_COLOR set).",
    )
    args = parser.parse_args()
    raise SystemExit(asyncio.run(_run(args)))


if __name__ == "__main__":
    main()
