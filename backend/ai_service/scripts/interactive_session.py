"""Interactive, type-your-own-answers walkthrough of the preference sub-agent.

This is the *interactive* sibling of ``scripts/demo_orchestrator.py``. Where the
demo scripts every member's Q&A answers as canned strings, THIS script hands the
keyboard to a tester: you play ONE member and *type* free-text answers to your
own AI preference sub-agent, watch it echo back what it captured, and then the
real master orchestrator reconciles the whole group and produces the TOP-5
restaurant picks. The other members auto-fill from the demo personas.

It is the terminal preview of the frontend ``AgentChatPage`` flow: a member
chats with their personal agent, a "noted so far" panel fills in, they finish
sharing, and the group lands on a shortlist (``TopPicksPage``).

Two important honesty notes — the same spirit as the demo's mocked providers:

  * **There is no wired free-text -> preferences logic in the backend.** The real
    ``normalize_member`` (app/ai/agents/preference_agent.py) is deterministic: it
    copies structured ``Profile`` columns straight through. So this script does
    the extraction itself — offline via a deterministic keyword/regex extractor
    over the *real* seed-catalog vocabulary (default), or via the real LLM under
    ``--live`` — then hands a structured Profile dict to the REAL
    ``normalize_member``. The resulting ``MemberPref`` is genuinely the agent's.
  * **The sub-agent's spoken reply is a templated UX stand-in.** The backend has
    no reply-generation logic (just like the demo's ``_mock_rerank_response``).
    The captured *signals* are real; only the conversational phrasing is scripted.

Modes:

  * DEFAULT (offline): no DB, no API keys, deterministic. Extraction is a local
    keyword/regex pass; retrieval + re-rank reuse the demo's offline stand-ins
    over the real seed catalog. Runs anywhere, including CI (piped stdin).
  * ``--live``: real OpenRouter embeddings + real pgvector search + real
    Salesforce/Claude extraction & re-rank, over the mock group. Needs a running
    DB + API keys (like the smoke test). Read/compute only — no rows written.

Run:
    cd backend/ai_service
    uv run python -m scripts.interactive_session                    # you play Alice (vegan)
    uv run python -m scripts.interactive_session --member bob        # play a different persona
    uv run python -m scripts.interactive_session --all-interactive   # type for every member
    uv run python -m scripts.interactive_session --answers-file a.txt # feed answers from a file
    uv run python -m scripts.interactive_session --live              # real backend path
    printf 'vegan\\nthai\\nno steak\\n$15 to 40\\n' | uv run python -m scripts.interactive_session

In-conversation commands: ``:skip`` (skip this question), ``:done`` (stop early),
``:quit`` (abort), ``:help`` (show commands).
"""

from __future__ import annotations

import argparse
import asyncio
import json
import re
import sys
from typing import Any

# --- Real pipeline building blocks (the sub-agent output is genuinely real) ---
from app.ai.agents.preference_agent import normalize_member
from app.ai.graph.state import MemberPref, PipelineState
from app.ai.llm.client import chat_completion
from app.ai.llm.prompts import build_preference_normalize_messages

# --- Reused verbatim from the demo (single source of truth; no drift) ---------
# Styling, narration helpers, the offline seed catalog, the shared fixtures, and
# the whole narrated orchestrator/top-picks/reconcile steps all come from the
# demo so the two scripts stay identical where they overlap. Cross-``_``-import
# is an established pattern in this scripts/ package.
from scripts.demo_orchestrator import (
    Ink,
    _DEMO_SESSION_ID,
    _MEMBERS,
    _SESSION_QA,
    _agent_says,
    _banner,
    _kv,
    _live_preflight,
    _load_mock_catalog,
    _make_ink,
    _note,
    _print_orchestrate_and_rank,
    _print_reconcile,
    _print_session_qa,
    _print_top_picks,
    _rule,
    _step,
    _substep,
    _user_says,
)


# ---------------------------------------------------------------------------
# Offline extractor — deterministic free-text -> structured signals.
#
# The backend has no free-text extraction, so we do it here (offline default).
# Everything below is pure, case-insensitive, and driven by the REAL seed-catalog
# vocabulary so any tag we extract is one the retriever can actually match.
# ---------------------------------------------------------------------------

# Canonical dietary tags are exactly the six the seed catalog carries. Anything
# outside this set can't be satisfied by the retriever's `@>` superset filter, so
# we map known synonyms onto these and drop the rest (with a visible note).
# Multi-word / phrase keys are listed first and matched before single words.
_DIETARY_SYNONYMS: list[tuple[str, str]] = [
    ("gluten free", "gluten_free"),
    ("gluten-free", "gluten_free"),
    ("no gluten", "gluten_free"),
    ("celiac", "gluten_free"),
    ("coeliac", "gluten_free"),
    ("tree nut", "nut_free"),
    ("tree nuts", "nut_free"),
    ("nut allergy", "nut_free"),
    ("nut-free", "nut_free"),
    ("nut free", "nut_free"),
    ("no nuts", "nut_free"),
    ("peanut", "nut_free"),
    ("vegan", "vegan"),
    ("vegetarian", "vegetarian"),
    ("veggie", "vegetarian"),
    ("halal", "halal"),
    ("kosher", "kosher"),
    ("gf", "gluten_free"),
]

# Extra cuisine phrasings not literally in the catalog vocabulary (singular /
# plural / near-words). The catalog tags themselves are matched dynamically.
_CUISINE_SYNONYMS: dict[str, str] = {
    "steak": "steakhouse",
    "steaks": "steakhouse",
    "banh mi": "vietnamese",
    "pho": "vietnamese",
    "veggie bowl": "bowls",
    "poke bowl": "poke",
}

# Pure negation / "no preference" answers -> capture nothing for that field.
_SKIP_ANSWERS: frozenset[str] = frozenset(
    {
        "",
        "no",
        "none",
        "nope",
        "nah",
        "nothing",
        "n/a",
        "na",
        "skip",
        "anything",
        "anything works",
        "anything's fine",
        "whatever",
        "no preference",
        "no preferences",
        "no restrictions",
        "no restriction",
        "none really",
        "no thanks",
        "nothing to avoid",
        "nothing off the table",
        "flexible",
        "i'm flexible",
        "im flexible",
        "open to anything",
    }
)


def _normalize(text: str) -> str:
    """Lowercase + collapse whitespace for matching."""
    return re.sub(r"\s+", " ", text.strip().lower())


def _is_skip(answer: str) -> bool:
    """True when the answer means 'no / none / flexible' (capture nothing)."""
    return _normalize(answer) in _SKIP_ANSWERS


def _cuisine_vocab() -> set[str]:
    """Union of every cuisine tag across the real seed catalog (the vocabulary)."""
    vocab: set[str] = set()
    for restaurant in _load_mock_catalog():
        vocab.update(restaurant.cuisine_tags)
    return vocab


def _extract_cuisines(answer: str, vocab: set[str]) -> list[str]:
    """Match catalog cuisine tags (and a few synonyms) as whole words in `answer`."""
    text = _normalize(answer)
    found: list[str] = []

    def _add(tag: str) -> None:
        if tag not in found:
            found.append(tag)

    # Catalog tags: match the tag itself and its de-underscored variant
    # (so "fine dining" matches `fine_dining`, "dim sum" -> `dim_sum`, etc.).
    for tag in sorted(vocab, key=len, reverse=True):
        variants = {tag, tag.replace("_", " ")}
        for variant in variants:
            if re.search(rf"\b{re.escape(variant)}\b", text):
                _add(tag)
                break

    # Hand synonyms for common phrasings not literally in the vocabulary.
    for phrase, tag in _CUISINE_SYNONYMS.items():
        if re.search(rf"\b{re.escape(phrase)}\b", text):
            _add(tag)

    return found


def _extract_dietary(answer: str) -> list[str]:
    """Map dietary synonyms in `answer` onto the six canonical catalog tags."""
    text = _normalize(answer)
    found: list[str] = []
    for phrase, tag in _DIETARY_SYNONYMS:
        if tag in found:
            continue
        if re.search(rf"\b{re.escape(phrase)}\b", text):
            found.append(tag)
    return found


def _extract_budget(answer: str) -> tuple[int | None, int | None]:
    """Parse a per-person budget from free text -> (min, max), either may be None.

    Ordered passes: explicit range, upper bound, lower bound, then a lone number
    treated as a ceiling (matching `_reconcile`'s tightest-cap logic).
    """
    text = _normalize(answer)

    m = re.search(r"(\d{1,4})\s*(?:-|–|to|through|and|thru)\s*\$?\s*(\d{1,4})", text)
    if m:
        lo, hi = int(m.group(1)), int(m.group(2))
        return (min(lo, hi), max(lo, hi))

    m = re.search(
        r"(?:under|below|less than|max|maximum|up to|no more than|at most|"
        r"cap(?:ped)?(?:\s*at)?)\s*\$?\s*(\d{1,4})",
        text,
    )
    if m:
        return (None, int(m.group(1)))

    m = re.search(
        r"(?:over|above|at least|min(?:imum)?|more than|starting at|from)\s*\$?\s*(\d{1,4})",
        text,
    )
    if m:
        return (int(m.group(1)), None)

    nums = re.findall(r"\d{1,4}", text)
    if nums:
        return (None, int(nums[0]))  # a lone number -> treat as the ceiling
    return (None, None)


# ---------------------------------------------------------------------------
# Live extractor (--live only): real LLM tag extraction. Budget stays local.
# ---------------------------------------------------------------------------


def _strip_fences(raw: str) -> str:
    """Strip markdown code fences so json.loads sees a bare payload."""
    text = raw.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[-1] if "\n" in text else ""
        if text.endswith("```"):
            text = text[: -len("```")]
        if text.lstrip().lower().startswith("json"):
            text = text.lstrip()[len("json"):]
    return text.strip()


async def _extract_tags_live(answer: str, ink: Ink) -> dict[str, list[str]] | None:
    """Call the real preference-normalize LLM; return the three tag lists.

    Returns None on any failure so the caller can fall back to the offline
    extractor for that answer (same graceful-degrade spirit as the smoke test).
    """
    try:
        messages = build_preference_normalize_messages(answer)
        raw = await chat_completion(messages, temperature=0.2) or ""
        data = json.loads(_strip_fences(raw))
    except Exception:  # noqa: BLE001 — any parse/transport failure -> offline fallback.
        _note(
            ink,
            "live extractor returned nothing parseable — using the offline "
            "extractor for this answer.",
        )
        return None

    def _clean(key: str) -> list[str]:
        value = data.get(key, []) if isinstance(data, dict) else []
        if not isinstance(value, list):
            return []
        out: list[str] = []
        for item in value:
            tag = str(item).strip().lower().replace(" ", "_")
            if tag and tag not in out:
                out.append(tag)
        return out

    return {
        "dietary": _clean("dietary_restrictions"),
        "preferred": _clean("preferred_cuisines"),
        "disliked": _clean("disliked_cuisines"),
    }


async def _extract_field(
    answer: str,
    field: str,
    vocab: set[str],
    *,
    live: bool,
    ink: Ink,
) -> dict[str, Any]:
    """Extract the signal(s) for the question `field` from one typed `answer`."""
    if field == "budget":
        bmin, bmax = _extract_budget(answer)
        return {"budget_min": bmin, "budget_max": bmax}

    if _is_skip(answer):
        return {field: []}

    if live:
        tags = await _extract_tags_live(answer, ink)
        if tags is not None:
            return {field: tags[field]}
        # fall through to offline on live-extractor failure.

    if field == "dietary":
        return {"dietary": _extract_dietary(answer)}
    # preferred / disliked both draw from the cuisine vocabulary.
    return {field: _extract_cuisines(answer, vocab)}


# ---------------------------------------------------------------------------
# stdin / answer source — TTY input, piped buffer, or --answers-file.
# ---------------------------------------------------------------------------


class _QuitInteractive(Exception):
    """Raised on :quit / Ctrl-D / Ctrl-C to abort the session gracefully."""


class _AnswerSource:
    """Where a member's answers come from: live TTY, a piped buffer, or a file.

    ``next()`` returns ``(text, origin)`` for a real answer, or ``None`` when a
    finite source (buffer/file) is exhausted — the caller then falls back to the
    persona's saved answer. In TTY mode, EOF/interrupt raises ``_QuitInteractive``.
    """

    def __init__(
        self,
        *,
        interactive: bool,
        buffered_lines: list[str] | None = None,
    ) -> None:
        self.interactive = interactive
        self._lines = buffered_lines
        self._idx = 0

    def next(self, prompt: str) -> tuple[str, str] | None:
        if self.interactive:
            try:
                return (input(prompt), "typed")
            except (EOFError, KeyboardInterrupt):
                raise _QuitInteractive from None
        # Finite buffered source (piped stdin or --answers-file).
        if self._lines is None or self._idx >= len(self._lines):
            return None
        line = self._lines[self._idx]
        self._idx += 1
        return (line, "buffered")


def _classify_command(answer: str) -> str | None:
    """Recognize in-band commands; return ':skip'/':done'/':quit'/':help' or None."""
    token = _normalize(answer)
    if token in (":skip", ":done", ":quit", ":help"):
        return token
    return None


def _stdin_is_tty() -> bool:
    try:
        return sys.stdin.isatty()
    except (ValueError, AttributeError):
        return False


# ---------------------------------------------------------------------------
# The interactive sub-agent conversation.
# ---------------------------------------------------------------------------

# Ordered questions: dietary -> preferred -> disliked -> budget. Order matches
# the personas' qa_turns and the reconcile inputs. Chips mirror AgentChatPage's
# quick-reply affordances.
_QUESTIONS: list[dict[str, Any]] = [
    {
        "field": "dietary",
        "prompt": (
            "Hi {name}! I'm your food agent for this session. First — any dietary "
            "needs I should lock in for the group search?"
        ),
        "chips": ["Vegan", "Gluten-free", "No nuts", "No restrictions"],
    },
    {
        "field": "preferred",
        "prompt": "Which cuisines make you happiest? What sounds good today?",
        "chips": ["Thai", "Italian", "Mexican", "Anything works"],
    },
    {
        "field": "disliked",
        "prompt": "Anything you'd rather the group avoided tonight?",
        "chips": ["No steakhouses", "Nothing fancy", "No BBQ", "Nothing to avoid"],
    },
    {
        "field": "budget",
        "prompt": "And your comfortable price range per person?",
        "chips": ["$15–20pp", "Under $20", "$20–40", "I'm flexible"],
    },
]


def _print_chips(ink: Ink, chips: list[str]) -> None:
    print(f"    {ink.dim('quick replies: [ ' + '  ·  '.join(chips) + ' ]')}")


def _reply_text(field: str, captured: dict[str, Any]) -> str:
    """Deterministic sub-agent reply confirming what was captured (UX stand-in)."""
    if field == "dietary":
        tags = captured["dietary"]
        if tags:
            return (
                f"Got it: {', '.join(tags)}. That's a HARD filter, so every pick "
                "will satisfy it. Next — what cuisines are you feeling?"
            )
        return (
            "No dietary restrictions — noted, you're flexible there. Next — what "
            "cuisines are you feeling?"
        )
    if field == "preferred":
        tags = captured["preferred"]
        if tags:
            return f"Love it — I'll steer the group toward {', '.join(tags)}. Anything to avoid?"
        return "No strong favorites — I'll keep your options open. Anything to avoid?"
    if field == "disliked":
        tags = captured["disliked"]
        if tags:
            return (
                f"Understood — I'll penalize {', '.join(tags)} in the ranking. "
                "Last one: your price range per person?"
            )
        return "Nothing off the table — easy. Last one: your price range per person?"
    # budget
    bmin, bmax = captured["budget_min"], captured["budget_max"]
    if bmin and bmax:
        span = f"${bmin}–{bmax}"
    elif bmax:
        span = f"up to ${bmax}"
    elif bmin:
        span = f"from ${bmin}"
    else:
        span = None
    if span:
        return (
            f"Locked in: {span} per person. I'll take the tightest cap across the "
            "group. That's everything — thanks!"
        )
    return (
        "No budget cap from you — I'll lean on the group's ceiling. That's "
        "everything — thanks!"
    )


def _render_noted(ink: Ink, captured: dict[str, Any], answered: set[str]) -> None:
    """Print the running 'noted so far' panel (✓ captured / ○ pending)."""

    def _row(field: str, label: str, value: str) -> str:
        if field not in answered:
            return f"      {ink.dim('○ ' + label + ': pending')}"
        return f"      {ink.good('✓')} {ink.dim(label + ':')} {value}"

    diet = ", ".join(captured["dietary"]) or "no restrictions"
    pref = ", ".join(captured["preferred"]) or "open"
    dis = ", ".join(captured["disliked"]) or "nothing"
    bmin, bmax = captured["budget_min"], captured["budget_max"]
    if bmin and bmax:
        budget = f"${bmin}–{bmax}"
    elif bmax:
        budget = f"up to ${bmax}"
    elif bmin:
        budget = f"from ${bmin}"
    else:
        budget = "group ceiling"

    print(f"    {ink.dim('— noted so far —')}")
    print(_row("dietary", "dietary", diet))
    print(_row("preferred", "likes", pref))
    print(_row("disliked", "avoids", dis))
    print(_row("budget", "budget", budget))


async def _run_interactive_member(
    ink: Ink,
    member: dict[str, Any],
    source: _AnswerSource,
    *,
    live: bool,
    vocab: set[str],
) -> MemberPref:
    """Drive one member's typed conversation, then run the REAL normalize_member."""
    name = member["display_name"]
    persona_answers = [answer for _q, answer in member["qa_turns"]]
    captured: dict[str, Any] = {
        "dietary": [],
        "preferred": [],
        "disliked": [],
        "budget_min": None,
        "budget_max": None,
    }
    answered: set[str] = set()
    fallback_noted = False

    print()
    _rule(ink, "·")
    print(
        f"    {ink.agent(ink.bold('▷ Preference sub-agent for ' + name))} "
        f"{ink.dim('(' + member['persona'] + ')')}"
    )
    print(f"    {ink.dim('Type your answer, or use :skip / :done / :quit / :help.')}")
    print()

    idx = 0
    while idx < len(_QUESTIONS):
        question = _QUESTIONS[idx]
        field = question["field"]

        _print_chips(ink, question["chips"])
        _agent_says(ink, f"{name}'s Agent", question["prompt"].format(name=name))

        result = source.next(ink.user("    you ▸ "))
        if result is None:
            # Finite source exhausted — auto-answer from the saved persona.
            if not fallback_noted:
                _note(
                    ink,
                    f"input exhausted — auto-answering the rest from {name}'s "
                    "saved profile.",
                )
                fallback_noted = True
            answer = persona_answers[idx] if idx < len(persona_answers) else ""
            origin = "persona"
        else:
            answer, origin = result

        command = _classify_command(answer)
        if command == ":quit":
            raise _QuitInteractive
        if command == ":help":
            _note(
                ink,
                ":skip = skip this question · :done = finish now · :quit = abort",
            )
            continue  # re-ask the same question
        if command == ":done":
            _note(ink, "finishing early — normalizing with what you've shared.")
            break
        if command == ":skip":
            answer = ""

        # In a live TTY the terminal already echoed the typed line; otherwise
        # render it into the styled stream so the transcript reads cleanly.
        if origin != "typed":
            _user_says(ink, name, answer or "(skipped)")

        signals = await _extract_field(answer, field, vocab, live=live, ink=ink)
        captured.update(signals)
        answered.add(field)

        # Honest note when a substantive answer matched no known catalog tag.
        if (
            field in ("dietary", "preferred", "disliked")
            and not _is_skip(answer)
            and not captured[field]
        ):
            _note(
                ink,
                f"didn't match a known catalog {field} tag — leaving it open "
                "(offline extractor; try --live for free-form phrasing).",
            )

        _render_noted(ink, captured, answered)
        _agent_says(ink, f"{name}'s Agent", _reply_text(field, captured))
        idx += 1

    # Build the structured Profile dict from the typed answers and hand it to the
    # REAL preference agent — the resulting MemberPref is genuinely its output.
    profile = {
        "user_id": member["profile"]["user_id"],
        "dietary_restrictions": captured["dietary"],
        "preferred_cuisines": captured["preferred"],
        "disliked_cuisines": captured["disliked"],
        "budget_min": captured["budget_min"] or 0,
        "budget_max": captured["budget_max"] or 0,
        "liked_restaurant_ids": [],
    }
    pref = await normalize_member(profile)

    print()
    _substep(ink, f"SUB-AGENT OUTPUT → normalized MemberPref for {name}:")
    _kv(ink, "user_id", str(pref.user_id))
    _kv(ink, "dietary_restrictions", str(pref.dietary_restrictions))
    _kv(ink, "preferred_cuisines", str(pref.preferred_cuisines))
    _kv(ink, "disliked_cuisines", str(pref.disliked_cuisines))
    _kv(ink, "budget (min/max)", f"${pref.budget_min} / ${pref.budget_max}")
    if not pref.budget_max:
        _note(
            ink,
            "no personal budget cap — reconcile ignores a 0 cap and uses the "
            "session's group ceiling instead.",
        )
    print(f"    {ink.agent('✔ END OF SUB-AGENT CONVERSATION for ' + name)}")
    return pref


async def _run_scripted_member(ink: Ink, member: dict[str, Any]) -> MemberPref:
    """Auto-fill a non-played member from their persona (canned Q&A), normalized."""
    name = member["display_name"]
    print()
    _rule(ink, "·")
    print(
        f"    {ink.agent(ink.bold('▷ Preference sub-agent for ' + name))} "
        f"{ink.dim('(' + member['persona'] + ')')} {ink.dim('· auto-filled')}"
    )
    print()
    for question, answer in member["qa_turns"]:
        _agent_says(ink, f"{name}'s Agent", question)
        _user_says(ink, name, answer)

    pref = await normalize_member(member["profile"])

    print()
    _substep(ink, f"SUB-AGENT OUTPUT → normalized MemberPref for {name}:")
    _kv(ink, "dietary_restrictions", str(pref.dietary_restrictions))
    _kv(ink, "preferred_cuisines", str(pref.preferred_cuisines))
    _kv(ink, "disliked_cuisines", str(pref.disliked_cuisines))
    _kv(ink, "budget (min/max)", f"${pref.budget_min} / ${pref.budget_max}")
    print(f"    {ink.agent('✔ END OF SUB-AGENT CONVERSATION for ' + name)}")
    return pref


async def _collect_member_prefs(
    ink: Ink,
    source: _AnswerSource,
    played: dict[str, Any],
    *,
    live: bool,
    all_interactive: bool,
    vocab: set[str],
) -> list[MemberPref]:
    """STEP 3/6: preference sub-agents (interactive for you, auto-filled for others)."""
    _step(ink, "3/6", "PREFERENCE SUB-AGENTS (you type; others auto-fill)")
    _note(
        ink,
        "Each diner's structured answers feed the REAL normalize_member; only "
        "the agent's phrasing is scripted.",
    )
    if not live:
        _note(
            ink,
            "Offline: your typed answers are parsed by a deterministic keyword/"
            "regex extractor over the seed-catalog vocabulary.",
        )

    prefs: list[MemberPref] = []
    for member in _MEMBERS:
        interactive_here = all_interactive or member["username"] == played["username"]
        if interactive_here:
            prefs.append(
                await _run_interactive_member(
                    ink, member, source, live=live, vocab=vocab
                )
            )
        else:
            prefs.append(await _run_scripted_member(ink, member))
    return prefs


# ---------------------------------------------------------------------------
# Roster / intro / outro.
# ---------------------------------------------------------------------------


def _print_intro(ink: Ink, live: bool, played: dict[str, Any], all_interactive: bool) -> None:
    _banner(ink, "GrubGroup · Preference Sub-Agent — Interactive Terminal Session")
    mode = (
        ink.warn("LIVE (real DB + embeddings + Claude)")
        if live
        else ink.good("OFFLINE (no DB, no API keys, deterministic)")
    )
    print(f"  Mode: {mode}")
    if all_interactive:
        who = ink.user(ink.bold("all four members"))
    else:
        who = f"{ink.user(ink.bold(played['display_name']))} {ink.dim('(' + played['persona'] + ')')}"
    print(f"  You are playing: {who}")
    print(
        "  "
        + ink.dim(
            "Talk to your AI preference agent by typing answers; it echoes what it\n"
            "  captured, then the master orchestrator picks restaurants for the "
            "whole group."
        )
    )


def _print_roster(ink: Ink, played: dict[str, Any], all_interactive: bool) -> None:
    _step(ink, "1/6", "THE GROUP (who is in this session)")
    print(
        f"    {ink.dim('Session id (demo):')} {_DEMO_SESSION_ID}   "
        f"{ink.dim('members:')} {len(_MEMBERS)}"
    )
    print()
    for i, member in enumerate(_MEMBERS, start=1):
        host = ink.dim("  (host)") if i == 1 else ""
        you = (
            f"  {ink.good('← you (interactive)')}"
            if all_interactive or member["username"] == played["username"]
            else ""
        )
        print(
            f"    {i}. {ink.user(ink.bold(member['display_name']))} "
            f"{ink.dim('@' + member['username'])}{host}{you}"
        )
        print(f"       {ink.dim(member['persona'])}")


def _print_outro(ink: Ink, live: bool) -> None:
    _rule(ink)
    print(
        f"  {ink.good('✔ DONE.')} "
        + ink.dim("Terminal preview of the member → sub-agent → group-picks flow.")
    )
    if not live:
        print(
            "  "
            + ink.dim(
                "When wired to the frontend, your typed answers arrive as real "
                "voice/text,\n  the offline extractor is replaced by the real LLM, "
                "and the mock catalog by\n  the seeded Postgres. Run --live to "
                "exercise the real path (needs DB + keys)."
            )
        )
    print()


# ---------------------------------------------------------------------------
# Member resolution + entry point.
# ---------------------------------------------------------------------------


def _resolve_member(name: str | None) -> dict[str, Any]:
    """Map --member (name / username / short name / 1-based index) to a persona."""
    if not name:
        return _MEMBERS[0]  # default: demo_alice (vegan)
    key = name.strip().lower()
    for member in _MEMBERS:
        candidates = {
            member["username"].lower(),
            member["display_name"].lower(),
            member["username"].lower().removeprefix("demo_"),
        }
        if key in candidates:
            return member
    if key.isdigit():
        idx = int(key) - 1
        if 0 <= idx < len(_MEMBERS):
            return _MEMBERS[idx]
    valid = ", ".join(m["username"].removeprefix("demo_") for m in _MEMBERS)
    raise SystemExit(f"Unknown --member {name!r}. Choose one of: {valid} (or 1–{len(_MEMBERS)}).")


def _build_answer_source(ink: Ink, answers_file: str | None) -> _AnswerSource:
    """Decide where answers come from and print a notice when non-interactive."""
    if answers_file:
        try:
            with open(answers_file, encoding="utf-8") as handle:
                lines = handle.read().splitlines()
        except OSError as exc:
            raise SystemExit(f"Cannot read --answers-file {answers_file!r}: {exc}") from exc
        _note(ink, f"Reading answers from {answers_file} (non-interactive).")
        return _AnswerSource(interactive=False, buffered_lines=lines)

    if _stdin_is_tty():
        return _AnswerSource(interactive=True)

    # Piped / non-TTY (e.g. CI): consume buffered stdin, fall back to personas.
    buffered = sys.stdin.read().splitlines() if not sys.stdin.closed else []
    _note(
        ink,
        "stdin is not a TTY — consuming piped answers, then falling back to each "
        "persona's saved answers.",
    )
    return _AnswerSource(interactive=False, buffered_lines=buffered)


async def _run(args: argparse.Namespace) -> int:
    ink = _make_ink(args.no_color)
    played = _resolve_member(args.member)

    _print_intro(ink, args.live, played, args.all_interactive)

    if args.live:
        if not await _live_preflight(ink):
            return 0  # environment issue, not a code bug — degrade gracefully.

    _print_roster(ink, played, args.all_interactive)
    _print_session_qa(ink)  # reused from the demo (STEP 2/6)

    source = _build_answer_source(ink, args.answers_file)

    try:
        prefs = await _collect_member_prefs(
            ink,
            source,
            played,
            live=args.live,
            all_interactive=args.all_interactive,
            vocab=_cuisine_vocab(),
        )
    except _QuitInteractive:
        print()
        _note(ink, "Session aborted (:quit). No picks generated.")
        return 0

    state = PipelineState(session_id=_DEMO_SESSION_ID, qa=_SESSION_QA, members=prefs)

    reconciled = _print_reconcile(ink, state)  # reused (STEP 4/6)
    state.reconciled = reconciled

    try:
        ranked = await _print_orchestrate_and_rank(  # reused (STEP 5/6)
            ink, state, reconciled, live=args.live, top_n=args.top
        )
    except Exception as exc:  # noqa: BLE001
        if args.live:
            print(
                f"    {ink.warn('✖ live pipeline call failed:')} "
                f"{type(exc).__name__}: {exc}"
            )
            _note(
                ink,
                "Likely a missing/rejected credential (OPENROUTER_API_KEY / "
                "SALESFORCE_API_KEY) or a TLS issue (NODE_EXTRA_CA_CERTS). Drop "
                "--live for the offline run.",
            )
            return 0
        raise

    _print_top_picks(ink, ranked, top_n=args.top)  # reused (STEP 6/6)
    _print_outro(ink, args.live)
    return 0


def main() -> None:
    """Parse args and run the interactive session."""
    parser = argparse.ArgumentParser(
        description=(
            "Interactive terminal walkthrough where you type answers to a "
            "member's AI preference sub-agent, then the orchestrator picks the "
            "group's top restaurants."
        )
    )
    parser.add_argument(
        "--live",
        action="store_true",
        help="Use the real providers (LLM extraction + OpenRouter embeddings + "
        "pgvector search + Claude re-rank). Needs a running DB + API keys. "
        "Default is a fully offline deterministic run.",
    )
    parser.add_argument(
        "--no-color",
        action="store_true",
        help="Disable ANSI colors (also auto-disabled when piped or NO_COLOR set).",
    )
    parser.add_argument(
        "--top",
        type=int,
        default=5,
        help="How many final picks to display (default: 5).",
    )
    parser.add_argument(
        "--member",
        default=None,
        help="Which persona you play: name/username (alice/bob/carol/dan) or "
        "1-based index. Default: alice (vegan).",
    )
    parser.add_argument(
        "--answers-file",
        default=None,
        help="Read answers (one per line) from a file instead of stdin — handy "
        "for repeatable runs.",
    )
    parser.add_argument(
        "--all-interactive",
        action="store_true",
        help="Type answers for every member, not just one.",
    )
    args = parser.parse_args()
    args.top = max(1, args.top)
    raise SystemExit(asyncio.run(_run(args)))


if __name__ == "__main__":
    main()
