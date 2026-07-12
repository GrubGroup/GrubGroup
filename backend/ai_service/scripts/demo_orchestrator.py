"""Narrated, mock-data walkthrough of the group recommendation pipeline.

This is the *demo* sibling of ``scripts/smoke_orchestrator.py``. Where the smoke
test proves the wiring works and prints terse ``[n/4]`` progress, this script is
built to be *watched in a terminal*: it narrates, step by step, exactly what
happens when a group of friends each talk to their own AI preference sub-agent
and a master orchestrator reconciles everyone into one ranked shortlist.

It prints, in order:

  * WHO the mock users are (the group roster + personas).
  * the group session Q&A (occasion / location / budget / time — the ``Qa`` row).
  * each member's spoken answers to their preference sub-agent's questions,
    and the sub-agent's normalized output (the real ``MemberPref``).
  * the master orchestrator's work: reconcile constraints -> build a query ->
    embed it -> hit the restaurant database (pgvector retrieval) -> LLM re-rank.
  * the final TOP 5 restaurants for the whole group, with justifications.

It is the terminal version of what the frontend will show once the backend is
wired to real user voice input. Two modes:

  * DEFAULT (offline mock): no database, no API keys, fully deterministic. It
    drives the *real* pipeline building blocks (``normalize_member``,
    ``_reconcile``, ``_build_query_text``, ``_parse_ranked``) and the *real*
    seed catalog, swapping only the three network/DB providers (embeddings,
    pgvector search, the LLM call) for local deterministic stand-ins. Anyone on
    the team can run it and always see a full top-5.
  * ``--live``: runs the real providers instead — real OpenRouter embeddings,
    real pgvector search against the seeded database, and the real Salesforce/
    Claude re-rank — over the same mock group. Needs a running DB + API keys
    (like the smoke test). No rows are written; this is a read/compute demo.

Run:
    cd backend/ai_service
    uv run python -m scripts.demo_orchestrator            # offline mock (default)
    uv run python -m scripts.demo_orchestrator --live     # real backend path
    uv run python -m scripts.demo_orchestrator --no-color  # disable ANSI colors
"""

from __future__ import annotations

import argparse
import asyncio
import hashlib
import json
import math
import os
import sys
from dataclasses import dataclass, field
from typing import Any

# Real pipeline building blocks — the demo drives these directly so the narrated
# steps are the *actual* logic, not a reimplementation. Only the three providers
# (embed / retrieve / re-rank) are swapped for local mocks in offline mode.
from app.ai.agents.orchestrator_agent import (
    _CANDIDATE_LIMIT,
    _build_query_text,
    _parse_ranked,
    _reconcile,
)
from app.ai.agents.preference_agent import normalize_member
from app.ai.graph.state import (
    CandidateRestaurant,
    MemberPref,
    PipelineState,
    QaSignals,
    RankedItem,
    ReconciledConstraints,
)
from app.ai.llm.prompts import build_group_rerank_messages

# ---------------------------------------------------------------------------
# Terminal styling (ANSI). Auto-disabled when piped, NO_COLOR set, or --no-color.
# ---------------------------------------------------------------------------


class Ink:
    """Tiny ANSI color helper; every method is a no-op when color is disabled."""

    def __init__(self, enabled: bool) -> None:
        self.enabled = enabled

    def _wrap(self, text: str, code: str) -> str:
        return f"\033[{code}m{text}\033[0m" if self.enabled else text

    def bold(self, t: str) -> str:
        return self._wrap(t, "1")

    def dim(self, t: str) -> str:
        return self._wrap(t, "2")

    def header(self, t: str) -> str:
        return self._wrap(t, "1;36")  # bold cyan

    def agent(self, t: str) -> str:
        return self._wrap(t, "35")  # magenta — the AI sub-agent / orchestrator

    def user(self, t: str) -> str:
        return self._wrap(t, "32")  # green — a human diner speaking

    def db(self, t: str) -> str:
        return self._wrap(t, "33")  # yellow — database / RAG access

    def sys(self, t: str) -> str:
        return self._wrap(t, "34")  # blue — pipeline/system step markers

    def good(self, t: str) -> str:
        return self._wrap(t, "1;32")  # bold green — final results

    def warn(self, t: str) -> str:
        return self._wrap(t, "1;33")


def _make_ink(no_color: bool) -> Ink:
    enabled = (
        not no_color
        and sys.stdout.isatty()
        and os.environ.get("NO_COLOR") is None
    )
    return Ink(enabled)


# ---------------------------------------------------------------------------
# Narration helpers — all output goes through these for a consistent look.
# ---------------------------------------------------------------------------

_WIDTH = 78


def _rule(ink: Ink, char: str = "─") -> None:
    print(ink.dim(char * _WIDTH))


def _banner(ink: Ink, title: str) -> None:
    """A boxed top-level banner."""
    print()
    print(ink.header("╔" + "═" * (_WIDTH - 2) + "╗"))
    inner = title.center(_WIDTH - 2)
    print(ink.header("║") + ink.header(ink.bold(inner)) + ink.header("║"))
    print(ink.header("╚" + "═" * (_WIDTH - 2) + "╝"))


def _step(ink: Ink, n: str, title: str) -> None:
    """A numbered pipeline step header (blue) with a rule under it."""
    print()
    print(ink.sys(f"━━ STEP {n} ─ {title} ").ljust(_WIDTH))
    _rule(ink)


def _substep(ink: Ink, label: str) -> None:
    print(ink.sys(f"  ▸ {label}"))


def _agent_says(ink: Ink, name: str, text: str) -> None:
    print(f"    {ink.agent('🤖 ' + name)}: {text}")


def _user_says(ink: Ink, name: str, text: str) -> None:
    print(f"    {ink.user('🗣  ' + name)}: {ink.user(text)}")


def _db_line(ink: Ink, text: str) -> None:
    print(f"    {ink.db('🗄  DB')}  {ink.db(text)}")


def _note(ink: Ink, text: str) -> None:
    print(f"    {ink.dim('· ' + text)}")


def _kv(ink: Ink, key: str, value: str) -> None:
    print(f"      {ink.dim(key + ':'):<28} {value}")


# ---------------------------------------------------------------------------
# Mock group — WHO the users are + what they "say" to their preference agent.
# ---------------------------------------------------------------------------
#
# Four deliberately DIVERGENT diners so the orchestrator's reconcile step does
# real work (dietary union, budget-min cap, cuisine weighting) rather than
# trivially agreeing — the same design idea as smoke_orchestrator, expanded to
# four so the top-5 is a genuine selection among many valid candidates.
#
# Each member carries a scripted `qa_turns` dialogue (agent question -> spoken
# answer). Those spoken answers map onto the structured Profile fields below;
# `normalize_member` (the real agent) then produces the MemberPref from the
# structured fields — exactly as it will from real saved profiles in prod.

MockMember = dict[str, Any]

_MEMBERS: list[MockMember] = [
    {
        "username": "demo_alice",
        "display_name": "Alice",
        "persona": "strict vegan, loves bold Thai + fresh Californian food",
        "profile": {
            "user_id": 1,
            "dietary_restrictions": ["vegan"],
            "preferred_cuisines": ["thai", "californian"],
            "disliked_cuisines": ["steakhouse"],
            "budget_min": 15,
            "budget_max": 40,
            "liked_restaurant_ids": [],
        },
        "qa_turns": [
            ("Hi Alice! Any dietary needs I should lock in for the group search?",
             "I'm fully vegan — that one's non-negotiable."),
            ("Got it, vegan it is. Which cuisines make you happiest?",
             "Thai for sure, and fresh Californian bowls."),
            ("Noted. Anything you'd rather the group avoided?",
             "Please, no steakhouses."),
            ("And your comfortable price range per person?",
             "Somewhere between $15 and $40 works."),
        ],
    },
    {
        "username": "demo_bob",
        "display_name": "Bob",
        "persona": "budget-tight, eats anything, wants cheap + tasty",
        "profile": {
            "user_id": 2,
            "dietary_restrictions": [],
            "preferred_cuisines": ["mexican", "vietnamese"],
            "disliked_cuisines": ["fine_dining"],
            "budget_min": 8,
            "budget_max": 20,
            "liked_restaurant_ids": [],
        },
        "qa_turns": [
            ("Hey Bob — any dietary restrictions?",
             "Nope, I'll eat anything."),
            ("Nice and easy. What are you craving?",
             "Something cheap and tasty — tacos, or a good banh mi."),
            ("Anything off the table?",
             "Nothing fancy or fine-dining, I'm on a budget."),
            ("What's your budget per head?",
             "Keep it under $20 — like $8 to $20."),
        ],
    },
    {
        "username": "demo_carol",
        "display_name": "Carol",
        "persona": "adventurous omnivore, bold flavors",
        "profile": {
            "user_id": 3,
            "dietary_restrictions": [],
            "preferred_cuisines": ["italian", "thai"],
            "disliked_cuisines": ["steakhouse", "german"],
            "budget_min": 20,
            "budget_max": 60,
            "liked_restaurant_ids": [],
        },
        "qa_turns": [
            ("Carol, any dietary needs on your end?",
             "No restrictions here."),
            ("Great. Favorite cuisines?",
             "Italian and Thai — I love bold flavors."),
            ("Anything to avoid tonight?",
             "No steakhouses, and no German food tonight."),
            ("Budget range?",
             "I'm flexible — $20 to $60."),
        ],
    },
    {
        "username": "demo_dan",
        "display_name": "Dan",
        "persona": "health-conscious, no restrictions but eats light",
        "profile": {
            "user_id": 4,
            "dietary_restrictions": [],
            "preferred_cuisines": ["healthy", "vietnamese", "californian"],
            "disliked_cuisines": ["bbq"],
            "budget_min": 12,
            "budget_max": 35,
            "liked_restaurant_ids": [],
        },
        "qa_turns": [
            ("Dan, any dietary needs?",
             "No hard restrictions, but I like to eat healthy."),
            ("Which cuisines are you feeling?",
             "Something healthy — Vietnamese, or a Californian bowl."),
            ("Anything you'd skip?",
             "I'll pass on heavy BBQ tonight."),
            ("And your budget?",
             "Around $12 to $35."),
        ],
    },
]

# Group session setup — the host answers the session-level questions. These map
# onto the `Qa` row the real app persists per session (occasion/location/budget/
# time-slot). Centered on downtown SF with a generous radius so the geo bounding
# box does not exclude the seed cluster.
_SESSION_QA_TURNS: list[tuple[str, str]] = [
    ("What's the occasion?", "Casual group dinner with friends."),
    ("Where should we look, and how far out?",
     "Around downtown San Francisco, within about 10 miles."),
    ("What time slot?", "Dinner, tonight."),
    ("Any overall group budget ceiling?", "Let's cap it around $45 a person."),
]

_SESSION_QA = QaSignals(
    occasion="casual group dinner",
    location_mode="manual",
    location_lat=37.7749,   # downtown San Francisco (matches the seed cluster)
    location_lon=-122.4194,
    radius_miles=10.0,
    time_slot="dinner",
    budget_min=8,
    budget_max=45,
)

_DEMO_SESSION_ID = 9001  # cosmetic only — offline mode never touches the DB.


# ---------------------------------------------------------------------------
# Offline mock providers (embed / retrieve / re-rank).
#
# These stand in for the three network/DB calls the real orchestrator makes.
# They are deterministic (no random, no clock) so every run is identical, and
# they reuse the REAL seed catalog so offline retrieval filters over the exact
# same restaurants a live DB would hold.
# ---------------------------------------------------------------------------

# Approximate miles-per-degree constant — copied from ai/rag/retriever.py so the
# offline bounding-box geo filter matches the SQL filter exactly.
_MILES_PER_DEG_LAT = 69.0


@dataclass
class _MockRestaurant:
    """Lightweight stand-in exposing the attributes orchestrate() reads."""

    id: int
    name: str
    cuisine_tags: list[str] = field(default_factory=list)
    dietary_tags: list[str] = field(default_factory=list)
    price_avg: float | None = None
    avg_rating: float | None = None
    lat: float | None = None
    long: float | None = None


def _load_mock_catalog() -> list[_MockRestaurant]:
    """Build the offline catalog from the real seed rows (assigning ids 1..N)."""
    # Reuse the exact hand-authored seed list — a pure function, no DB/network.
    from scripts.seed_restaurants import _mock_restaurants

    catalog: list[_MockRestaurant] = []
    for idx, row in enumerate(_mock_restaurants(), start=1):
        catalog.append(
            _MockRestaurant(
                id=idx,
                name=row["name"],
                cuisine_tags=list(row["cuisine_tags"]),
                dietary_tags=list(row["dietary_tags"]),
                price_avg=row["price_avg"],
                avg_rating=row["avg_rating"],
                lat=row["lat"],
                long=row["long"],
            )
        )
    return catalog


def _mock_embed(text: str, dims: int = 1024) -> list[float]:
    """Deterministic pseudo-embedding from a text hash (no network, no random).

    Not semantically meaningful — it exists so the narration can show a concrete
    1024-dim vector. Offline retrieval ranks by a preference-affinity score
    (below), not by this vector, which is what keeps the top-5 sensible.
    """
    digest = hashlib.sha256(text.encode("utf-8")).digest()
    # Expand the 32-byte digest into `dims` floats in [-1, 1], cycling bytes.
    return [((digest[i % len(digest)] / 255.0) * 2.0) - 1.0 for i in range(dims)]


def _affinity(
    r: _MockRestaurant, reconciled: ReconciledConstraints
) -> float:
    """Preference-affinity score in [0, 1] for offline ranking / re-rank.

    Blends reconciled cuisine weights (tanh-squashed), rating, and price fit.
    Mirrors, in spirit, what the LLM re-rank optimizes for so the offline top-5
    reads like a real recommendation. Higher = better; distance = 1 - score.
    """
    weight_sum = sum(
        reconciled.cuisine_weights.get(tag, 0.0) for tag in r.cuisine_tags
    )
    cuisine_score = (math.tanh(weight_sum / 2.0) + 1.0) / 2.0  # 0..1

    rating = r.avg_rating if r.avg_rating is not None else 3.5
    rating_score = max(0.0, min(1.0, (rating - 3.5) / (5.0 - 3.5)))

    price_score = 0.5
    if reconciled.price_max and r.price_avg is not None and reconciled.price_max > 0:
        price_score = max(
            0.0, min(1.0, (reconciled.price_max - r.price_avg) / reconciled.price_max)
        )

    raw = 0.55 * cuisine_score + 0.30 * rating_score + 0.15 * price_score
    return round(max(0.0, min(1.0, raw)), 4)


def _mock_similarity_search(
    catalog: list[_MockRestaurant],
    reconciled: ReconciledConstraints,
    *,
    limit: int,
) -> list[tuple[_MockRestaurant, float]]:
    """Offline pgvector stand-in: apply the SAME hard filters, then rank.

    Mirrors ai/rag/retriever.similarity_search's WHERE clauses (dietary superset
    `@>`, price cap, geo bounding box) so the candidate set matches what the live
    SQL query would return, then orders ascending by (1 - affinity) as a proxy
    for cosine distance.
    """
    required = set(reconciled.required_dietary or [])
    hits: list[tuple[_MockRestaurant, float]] = []

    # Precompute the geo bounding box once (matches retriever.py math).
    box: tuple[float, float, float, float] | None = None
    if reconciled.center is not None and reconciled.radius_miles is not None:
        lat, lon = reconciled.center
        lat_delta = reconciled.radius_miles / _MILES_PER_DEG_LAT
        cos_lat = math.cos(math.radians(lat))
        lon_scale = _MILES_PER_DEG_LAT * max(abs(cos_lat), 1e-6)
        lon_delta = reconciled.radius_miles / lon_scale
        box = (lat - lat_delta, lat + lat_delta, lon - lon_delta, lon + lon_delta)

    for r in catalog:
        # dietary_tags must be a superset of the required tags (`@>`).
        if required and not required.issubset(set(r.dietary_tags)):
            continue
        # price cap.
        if reconciled.price_max is not None:
            if r.price_avg is None or r.price_avg > reconciled.price_max:
                continue
        # geo bounding box.
        if box is not None:
            if r.lat is None or r.long is None:
                continue
            lat_lo, lat_hi, lon_lo, lon_hi = box
            if not (lat_lo <= r.lat <= lat_hi and lon_lo <= r.long <= lon_hi):
                continue

        distance = round(1.0 - _affinity(r, reconciled), 4)
        hits.append((r, distance))

    hits.sort(key=lambda pair: pair[1])  # ascending distance (nearest first)
    return hits[:limit]


def _mock_rerank_response(
    candidates: list[CandidateRestaurant], reconciled: ReconciledConstraints
) -> str:
    """Produce the strict-JSON array the LLM re-rank *would* return.

    Scores each candidate with the same affinity heuristic, sorts best-first, and
    writes a one-sentence justification referencing the matched cuisines/dietary/
    price. The real `_parse_ranked` then validates this exactly as it validates a
    genuine Claude response — so the offline path exercises real parsing.
    """
    preferred = {c for c, w in reconciled.cuisine_weights.items() if w > 0}
    required = set(reconciled.required_dietary or [])

    scored: list[tuple[CandidateRestaurant, float]] = []
    for c in candidates:
        r = _MockRestaurant(
            id=c.id,
            name=c.name,
            cuisine_tags=c.cuisine_tags,
            dietary_tags=c.dietary_tags,
            price_avg=c.price_avg,
            avg_rating=c.avg_rating,
        )
        scored.append((c, _affinity(r, reconciled)))
    scored.sort(key=lambda pair: pair[1], reverse=True)

    entries: list[dict[str, Any]] = []
    for c, score in scored:
        matched_cuisines = [t for t in c.cuisine_tags if t in preferred]
        matched_dietary = [t for t in c.dietary_tags if t in required]
        bits: list[str] = []
        if matched_cuisines:
            bits.append(f"hits the group's {', '.join(matched_cuisines)} craving")
        if matched_dietary:
            bits.append(f"is {', '.join(matched_dietary)}-friendly")
        if c.price_avg is not None:
            bits.append(f"lands at ~${c.price_avg:.0f}/person")
        justification = (
            f"{c.name} " + (", ".join(bits) if bits else "fits the group's brief")
            + "."
        )
        entries.append(
            {
                "restaurant_id": c.id,
                "match_score": round(score, 3),
                "justification": justification,
            }
        )
    return json.dumps(entries, ensure_ascii=False, indent=2)


# ---------------------------------------------------------------------------
# The narrated flow.
# ---------------------------------------------------------------------------


def _print_intro(ink: Ink, live: bool) -> None:
    _banner(ink, "GrubGroup · Group Recommendation Pipeline — Terminal Demo")
    mode = ink.warn("LIVE (real DB + embeddings + Claude)") if live else ink.good(
        "OFFLINE MOCK (no DB, no API keys, deterministic)"
    )
    print(f"  Mode: {mode}")
    print(
        "  "
        + ink.dim(
            "This traces what happens when a group each talks to their own AI "
            "preference\n  agent and a master orchestrator picks restaurants for "
            "everyone. It is the\n  terminal preview of the flow the frontend will "
            "drive with real voice input."
        )
    )
    if not live:
        _note(
            ink,
            "Real pipeline logic runs (normalize_member, _reconcile, "
            "_build_query_text,",
        )
        _note(ink, "  _parse_ranked) over the real seed catalog; only embed / "
                   "pgvector / LLM are mocked.")


def _print_roster(ink: Ink) -> None:
    _step(ink, "1/6", "THE GROUP (who is in this session)")
    print(f"    {ink.dim('Session id (demo):')} {_DEMO_SESSION_ID}   "
          f"{ink.dim('members:')} {len(_MEMBERS)}")
    print()
    for i, m in enumerate(_MEMBERS, start=1):
        host = ink.dim("  (host)") if i == 1 else ""
        print(f"    {i}. {ink.user(ink.bold(m['display_name']))} "
              f"{ink.dim('@' + m['username'])}{host}")
        print(f"       {ink.dim(m['persona'])}")


def _print_session_qa(ink: Ink) -> None:
    _step(ink, "2/6", "GROUP SESSION SETUP (host answers session Q&A → Qa row)")
    _note(ink, "In production these become the session's `Qa` row "
               "(occasion / location / budget / time).")
    print()
    host = _MEMBERS[0]["display_name"]
    for q, a in _SESSION_QA_TURNS:
        _agent_says(ink, "Session Agent", q)
        _user_says(ink, host, a)
    print()
    _substep(ink, "Parsed session signals (QaSignals):")
    _kv(ink, "occasion", str(_SESSION_QA.occasion))
    _kv(ink, "location", f"({_SESSION_QA.location_lat}, {_SESSION_QA.location_lon}) "
                         f"mode={_SESSION_QA.location_mode}")
    _kv(ink, "radius_miles", str(_SESSION_QA.radius_miles))
    _kv(ink, "time_slot", str(_SESSION_QA.time_slot))
    _kv(ink, "budget (min/max)", f"${_SESSION_QA.budget_min} / ${_SESSION_QA.budget_max}")


async def _print_preference_agents(ink: Ink) -> list[MemberPref]:
    """Narrate each member's sub-agent conversation; return normalized prefs.

    This is the pipeline's fan-out step: one preference sub-agent per member
    (`_preference_node` -> `normalize_member` via a LangGraph `Send`). Here we
    run them sequentially so the terminal output is readable; in the real graph
    they run concurrently and converge via the additive `members` reducer.
    """
    _step(ink, "3/6", "PREFERENCE SUB-AGENTS (fan-out: one agent per member)")
    _note(ink, "LangGraph fans out a `Send` per member → preference_agent."
               "normalize_member().")
    _note(ink, "Each diner speaks; their agent normalizes the answers into a "
               "structured MemberPref.")

    prefs: list[MemberPref] = []
    for m in _MEMBERS:
        name = m["display_name"]
        print()
        _rule(ink, "·")
        print(f"    {ink.agent(ink.bold('▷ Preference sub-agent for ' + name))} "
              f"{ink.dim('(' + m['persona'] + ')')}")
        print()
        for q, a in m["qa_turns"]:
            _agent_says(ink, f"{name}'s Agent", q)
            _user_says(ink, name, a)

        # The REAL agent turns the structured profile into a MemberPref. (The
        # scripted answers above map onto exactly these Profile columns.)
        pref = await normalize_member(m["profile"])
        prefs.append(pref)

        print()
        _substep(ink, f"SUB-AGENT OUTPUT → normalized MemberPref for {name}:")
        _kv(ink, "user_id", str(pref.user_id))
        _kv(ink, "dietary_restrictions", str(pref.dietary_restrictions) or "[]")
        _kv(ink, "preferred_cuisines", str(pref.preferred_cuisines))
        _kv(ink, "disliked_cuisines", str(pref.disliked_cuisines))
        _kv(ink, "budget (min/max)", f"${pref.budget_min} / ${pref.budget_max}")
        print(f"    {ink.agent('✔ END OF SUB-AGENT CONVERSATION for ' + name)}")

    return prefs


def _print_reconcile(
    ink: Ink, state: PipelineState
) -> ReconciledConstraints:
    """Run + narrate the orchestrator's reconcile step (the real `_reconcile`)."""
    _step(ink, "4/6", "MASTER ORCHESTRATOR — reconcile the whole group")
    _note(ink, "Union all dietary needs (HARD), take the tightest budget cap, "
               "and weight cuisines")
    _note(ink, "(preferred +1 each, disliked −1 each), summed across members.")

    reconciled = _reconcile(state)
    print()
    _substep(ink, "Reconciled group constraints:")
    _kv(ink, "required_dietary (HARD)", ink.warn(str(reconciled.required_dietary)))
    price = "none" if reconciled.price_max is None else f"${reconciled.price_max:.0f}"
    _kv(ink, "price_max (tightest cap)", ink.warn(price))
    _kv(ink, "center / radius",
        f"{reconciled.center} / {reconciled.radius_miles} mi")
    # Show cuisine weights sorted most-preferred first.
    weights = sorted(
        reconciled.cuisine_weights.items(), key=lambda kv: kv[1], reverse=True
    )
    pretty = ", ".join(f"{c}:{w:+.0f}" for c, w in weights)
    _kv(ink, "cuisine_weights", pretty or "{}")
    return reconciled


async def _print_orchestrate_and_rank(
    ink: Ink,
    state: PipelineState,
    reconciled: ReconciledConstraints,
    *,
    live: bool,
    top_n: int,
) -> list[tuple[RankedItem, CandidateRestaurant]]:
    """Narrate build-query → embed → retrieve → LLM re-rank → final ranking.

    Mirrors ``orchestrator_agent.orchestrate`` step for step, swapping the three
    providers for offline mocks unless ``live`` is set. Returns the ranked items
    paired with their candidate payloads (for the final printout).
    """
    # --- 4a. Build the retrieval query text (real helper) -------------------
    _step(ink, "5/6", "MASTER ORCHESTRATOR — retrieve candidates (RAG) + re-rank")
    query_text = _build_query_text(reconciled, state)
    _substep(ink, "Built natural-language retrieval query:")
    print(f"      {ink.dim(query_text)}")

    # --- 4b. Embed the query ------------------------------------------------
    print()
    if live:
        _substep(ink, "Embedding query via OpenRouter (Qwen3, 1024-dim) …")
        from app.ai.rag.embeddings import embed_text

        query_embedding = await embed_text(query_text)
    else:
        _substep(ink, "Embedding query (offline deterministic stand-in, 1024-dim) …")
        query_embedding = _mock_embed(query_text)
    preview = ", ".join(f"{v:+.3f}" for v in query_embedding[:8])
    _kv(ink, "embedding.len", str(len(query_embedding)))
    _kv(ink, "embedding[:8]", f"[{preview}, …]")

    # --- 4c. Retrieve from the restaurant DB (pgvector) ---------------------
    print()
    _db_line(ink, "ACCESS DATABASE → pgvector similarity_search (cosine `<=>`)")
    _db_line(ink, "hard filters pushed into SQL: dietary superset `@>`, "
                  "price cap, geo box")
    if live:
        from app.ai.rag.retriever import similarity_search

        hits = await similarity_search(
            query_embedding,
            limit=_CANDIDATE_LIMIT,
            required_dietary_tags=reconciled.required_dietary or None,
            price_max=reconciled.price_max,
            center=reconciled.center,
            radius_miles=reconciled.radius_miles,
        )
    else:
        catalog = _load_mock_catalog()
        _db_line(ink, f"(offline) scanning mock seed catalog of {len(catalog)} "
                      f"restaurants")
        hits = _mock_similarity_search(catalog, reconciled, limit=_CANDIDATE_LIMIT)

    candidates = [
        CandidateRestaurant(
            id=r.id,
            name=r.name,
            cuisine_tags=list(r.cuisine_tags or []),
            dietary_tags=list(r.dietary_tags or []),
            price_avg=r.price_avg,
            avg_rating=r.avg_rating,
            distance=distance,
        )
        for r, distance in hits
        if r.id is not None
    ]
    _db_line(ink, f"retrieved {len(candidates)} candidate(s) that passed all "
                  f"hard filters:")
    for c in candidates:
        dist = f"{c.distance:.4f}" if c.distance is not None else "n/a"
        print(f"        {ink.db('•')} {c.name}  "
              f"{ink.dim(f'[{', '.join(c.cuisine_tags)}]')}  "
              f"{ink.dim(f'~${c.price_avg:.0f}' if c.price_avg else '')}  "
              f"{ink.dim('dist=' + dist)}")
    print(f"    {ink.db('✔ END OF DATABASE ACCESS')}")

    if not candidates:
        _note(ink, "No restaurants passed the hard filters — the pipeline yields "
                   "an empty result.")
        return []

    # --- 4d. LLM re-rank ----------------------------------------------------
    print()
    messages = build_group_rerank_messages(
        reconciled=reconciled.model_dump(),
        candidates=[c.model_dump() for c in candidates],
    )
    if live:
        _substep(ink, "Calling the LLM re-rank (Salesforce gateway → Claude, "
                      "temperature=0.2) …")
        from app.ai.llm.client import chat_completion

        raw = await chat_completion(messages, temperature=0.2) or ""
    else:
        _substep(ink, "LLM re-rank (offline stand-in emitting the strict-JSON "
                      "Claude would return) …")
        raw = _mock_rerank_response(candidates, reconciled)
    _note(ink, f"raw model response ({len(raw)} chars) — validated by the REAL "
               f"_parse_ranked:")
    for line in raw.strip().splitlines()[:14]:
        print(f"        {ink.dim(line)}")
    if len(raw.strip().splitlines()) > 14:
        print(f"        {ink.dim('… (truncated)')}")

    # --- Real parsing + real distance-ranked fallback -----------------------
    valid_ids = {c.id for c in candidates}
    ranked = _parse_ranked(raw, valid_ids)
    if ranked:
        _substep(ink, f"_parse_ranked accepted {len(ranked)} of "
                      f"{len(candidates)} candidates.")
    else:
        # Same fallback the real orchestrator uses when the LLM returns nothing
        # parseable — rank by retrieval distance so we still emit valid output.
        _substep(ink, ink.warn("LLM returned nothing parseable → "
                               "distance-ranked FALLBACK engaged."))
        ordered = sorted(
            candidates, key=lambda c: (c.distance if c.distance is not None else 1.0)
        )
        ranked = [
            RankedItem(
                restaurant_id=c.id,
                match_score=round(max(0.0, 1.0 - (c.distance or 0.0)), 4),
                justification="Ranked by embedding similarity (LLM re-rank "
                              "unavailable).",
            )
            for c in ordered
        ]

    by_id = {c.id: c for c in candidates}
    return [(item, by_id[item.restaurant_id]) for item in ranked]


def _print_top_picks(
    ink: Ink,
    ranked: list[tuple[RankedItem, CandidateRestaurant]],
    *,
    top_n: int,
) -> None:
    _step(ink, "6/6", f"FINAL RESULT — the orchestrator's TOP {top_n} for the group")
    if not ranked:
        _note(ink, "(empty) — no picks were produced.")
        return

    _note(ink, f"Full ranking has {len(ranked)} restaurant(s); showing the "
               f"top {min(top_n, len(ranked))}.")
    print()
    for rank, (item, cand) in enumerate(ranked[:top_n], start=1):
        medal = {1: "🥇", 2: "🥈", 3: "🥉"}.get(rank, f" {rank}.")
        print(f"    {ink.good(medal)} {ink.good(ink.bold(cand.name))}  "
              f"{ink.dim(f'[match {item.match_score:.2f}]')}")
        tags = ", ".join(cand.cuisine_tags)
        diet = ", ".join(cand.dietary_tags) or "—"
        price = f"~${cand.price_avg:.0f}" if cand.price_avg is not None else "n/a"
        rating = f"{cand.avg_rating:.1f}★" if cand.avg_rating is not None else "n/a"
        print(f"        {ink.dim('cuisine:')} {tags}")
        print(f"        {ink.dim('dietary:')} {diet}   "
              f"{ink.dim('price:')} {price}   {ink.dim('rating:')} {rating}")
        print(f"        {ink.dim('why:')} {item.justification}")
        print()


def _print_outro(ink: Ink, live: bool) -> None:
    _rule(ink)
    print(f"  {ink.good('✔ DONE.')} "
          + ink.dim("This is the terminal preview of the group recommendation "
                    "flow."))
    if not live:
        print("  " + ink.dim(
            "When wired to the frontend, the scripted answers above are replaced "
            "by real\n  voice/text input, the mock catalog by the seeded Postgres "
            "restaurants, and the\n  offline stand-ins by real OpenRouter "
            "embeddings + Claude re-rank. Run --live to\n  exercise that real path "
            "(needs a running DB + API keys, like the smoke test)."
        ))
    print()


# ---------------------------------------------------------------------------
# Live-mode preflight (only relevant with --live).
# ---------------------------------------------------------------------------


async def _live_preflight(ink: Ink) -> bool:
    """Check DB reachability + seeded restaurants for --live. Return ok."""
    from sqlalchemy import text

    from app.core.config import settings
    from app.crud import restaurant as restaurant_crud
    from app.db.session import async_session_factory

    _substep(ink, "Live preflight — checking database + seed catalog …")
    _kv(ink, "DATABASE_URL", settings.database_url)
    _kv(ink, "LLM model", settings.llm_model)
    _kv(ink, "Embed model", settings.embedding_model)

    try:
        async with async_session_factory() as db:
            await db.execute(text("SELECT 1"))
            embedded = await restaurant_crud.count_with_embedding(db)
    except Exception as exc:  # noqa: BLE001 — surface a hint, don't traceback.
        print(f"    {ink.warn('✖ cannot reach the database:')} "
              f"{type(exc).__name__}: {exc}")
        _note(ink, "Ensure Postgres+pgvector is running and DATABASE_URL is set, "
                   "then retry --live.")
        _note(ink, "Or drop --live to run the fully offline mock (no DB needed).")
        return False

    if embedded == 0:
        print(f"    {ink.warn('✖ no embedded restaurants found.')}")
        _note(ink, "Seed first:  uv run python -m scripts.seed_restaurants")
        _note(ink, "Or drop --live to run the fully offline mock.")
        return False

    _kv(ink, "restaurants with embedding", str(embedded))
    return True


# ---------------------------------------------------------------------------
# Entry point.
# ---------------------------------------------------------------------------


async def _run(live: bool, no_color: bool, top_n: int) -> int:
    ink = _make_ink(no_color)
    _print_intro(ink, live)

    if live:
        ok = await _live_preflight(ink)
        if not ok:
            return 0  # graceful — environment issue, not a code bug.

    # STEP 1-2: who's in the group + the session-level Q&A.
    _print_roster(ink)
    _print_session_qa(ink)

    # STEP 3: preference sub-agents (fan-out) → normalized MemberPrefs.
    prefs = await _print_preference_agents(ink)

    # Assemble the real PipelineState the orchestrator consumes.
    state = PipelineState(
        session_id=_DEMO_SESSION_ID,
        qa=_SESSION_QA,
        members=prefs,
    )

    # STEP 4: reconcile the group (real _reconcile).
    reconciled = _print_reconcile(ink, state)
    state.reconciled = reconciled

    # STEP 5: retrieve + re-rank.
    try:
        ranked = await _print_orchestrate_and_rank(
            ink, state, reconciled, live=live, top_n=top_n
        )
    except Exception as exc:  # noqa: BLE001
        if live:
            print(f"    {ink.warn('✖ live pipeline call failed:')} "
                  f"{type(exc).__name__}: {exc}")
            _note(ink, "Likely a missing/rejected credential (OPENROUTER_API_KEY / "
                       "SALESFORCE_API_KEY) or")
            _note(ink, "a TLS issue (set NODE_EXTRA_CA_CERTS). Drop --live for the "
                       "offline mock.")
            return 0
        raise

    # STEP 6: final top-N.
    _print_top_picks(ink, ranked, top_n=top_n)
    _print_outro(ink, live)
    return 0


def main() -> None:
    """Parse args and run the narrated demo."""
    parser = argparse.ArgumentParser(
        description="Narrated mock-data walkthrough of the GrubGroup group "
                    "recommendation pipeline."
    )
    parser.add_argument(
        "--live",
        action="store_true",
        help="Run the real providers (OpenRouter embeddings + pgvector search + "
             "Salesforce/Claude re-rank) over the mock group. Needs a running DB "
             "+ API keys. Default is a fully offline deterministic mock.",
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
    args = parser.parse_args()
    raise SystemExit(asyncio.run(_run(args.live, args.no_color, max(1, args.top))))


if __name__ == "__main__":
    main()
