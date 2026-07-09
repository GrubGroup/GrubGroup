"""Group orchestrator node: reconcile prefs, retrieve, and LLM re-rank."""

from __future__ import annotations

import json

from app.ai.graph.state import (
    CandidateRestaurant,
    PipelineState,
    RankedItem,
    ReconciledConstraints,
)
from app.ai.llm.client import chat_completion
from app.ai.llm.prompts import build_group_rerank_messages
from app.ai.rag.embeddings import embed_text
from app.ai.rag.retriever import similarity_search

# How many candidates to pull from pgvector before the LLM re-rank pass.
_CANDIDATE_LIMIT = 20


def _reconcile(state: PipelineState) -> ReconciledConstraints:
    """Merge member prefs + Qa signals into hard/soft group constraints.

    required_dietary is the UNION of every member's dietary_restrictions and is
    treated as HARD downstream. price_max is the most constraining budget cap —
    the min of members' budget_max, further tightened by qa.budget_max if lower.
    cuisine_weights reward preferred cuisines (+1 each) and penalize disliked
    ones (-1 each), summed across members. center/radius come from Qa.
    """
    required_dietary: list[str] = []
    seen_dietary: set[str] = set()
    budget_caps: list[int] = []
    cuisine_weights: dict[str, float] = {}

    for member in state.members:
        for tag in member.dietary_restrictions:
            if tag and tag not in seen_dietary:
                seen_dietary.add(tag)
                required_dietary.append(tag)
        if member.budget_max:
            budget_caps.append(member.budget_max)
        for cuisine in member.preferred_cuisines:
            if cuisine:
                cuisine_weights[cuisine] = cuisine_weights.get(cuisine, 0.0) + 1.0
        for cuisine in member.disliked_cuisines:
            if cuisine:
                cuisine_weights[cuisine] = cuisine_weights.get(cuisine, 0.0) - 1.0

    price_max: float | None = min(budget_caps) if budget_caps else None
    if state.qa.budget_max is not None:
        price_max = (
            float(state.qa.budget_max)
            if price_max is None
            else min(price_max, float(state.qa.budget_max))
        )

    center: tuple[float, float] | None = None
    if state.qa.location_lat is not None and state.qa.location_lon is not None:
        center = (state.qa.location_lat, state.qa.location_lon)

    return ReconciledConstraints(
        required_dietary=required_dietary,
        price_max=price_max,
        center=center,
        radius_miles=state.qa.radius_miles,
        cuisine_weights=cuisine_weights,
    )


def _build_query_text(
    reconciled: ReconciledConstraints, state: PipelineState
) -> str:
    """Compose a natural-language query string to embed for retrieval."""
    parts: list[str] = ["Group dining recommendation."]
    if state.qa.occasion:
        parts.append(f"Occasion: {state.qa.occasion}.")
    if state.qa.time_slot:
        parts.append(f"Time: {state.qa.time_slot}.")

    liked = [c for c, w in reconciled.cuisine_weights.items() if w > 0]
    disliked = [c for c, w in reconciled.cuisine_weights.items() if w < 0]
    if liked:
        parts.append(f"Preferred cuisines: {', '.join(sorted(liked))}.")
    if disliked:
        parts.append(f"Avoid cuisines: {', '.join(sorted(disliked))}.")
    if reconciled.required_dietary:
        parts.append(
            f"Must satisfy dietary needs: {', '.join(reconciled.required_dietary)}."
        )
    if reconciled.price_max is not None:
        parts.append(f"Budget per person up to {reconciled.price_max:.0f}.")
    return " ".join(parts)


def _strip_json_fence(raw: str) -> str:
    """Strip markdown code fences so json.loads sees a bare JSON payload."""
    text = raw.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[-1] if "\n" in text else text
        if text.endswith("```"):
            text = text[: -len("```")]
        # Drop a leading language hint (e.g. ``` remaining after "```json").
        if text.lstrip().lower().startswith("json"):
            text = text.lstrip()[len("json"):]
    return text.strip()


def _parse_ranked(raw: str, valid_ids: set[int]) -> list[RankedItem]:
    """Parse the strict-JSON re-rank response into validated RankedItems.

    Robust to code fences and to the model wrapping the array in an object.
    Each item must reference a known candidate id; match_score is clamped to
    [0, 1] and justification is truncated to 240 chars. Malformed entries and
    unknown/duplicate ids are dropped.
    """
    if not raw:
        return []
    try:
        parsed = json.loads(_strip_json_fence(raw))
    except (ValueError, TypeError):
        return []

    if isinstance(parsed, dict):
        # Tolerate {"items": [...]} / {"results": [...]} / {"ranking": [...]}.
        for key in ("items", "results", "ranking", "recommendations"):
            if isinstance(parsed.get(key), list):
                parsed = parsed[key]
                break
    if not isinstance(parsed, list):
        return []

    ranked: list[RankedItem] = []
    used_ids: set[int] = set()
    for entry in parsed:
        if not isinstance(entry, dict):
            continue
        try:
            restaurant_id = int(entry["restaurant_id"])
        except (KeyError, TypeError, ValueError):
            continue
        if restaurant_id not in valid_ids or restaurant_id in used_ids:
            continue
        try:
            score = float(entry.get("match_score", 0.0))
        except (TypeError, ValueError):
            score = 0.0
        score = max(0.0, min(1.0, score))
        justification = str(entry.get("justification", "") or "")[:240]

        used_ids.add(restaurant_id)
        ranked.append(
            RankedItem(
                restaurant_id=restaurant_id,
                match_score=score,
                justification=justification,
            )
        )
    return ranked


async def orchestrate(state: PipelineState) -> PipelineState:
    """Reconcile prefs, retrieve candidates, LLM re-rank, and fill state.ranked.

    Returns the same PipelineState mutated with `reconciled`, `candidates`, and
    `ranked`. `ranked` items match the RecommendationItem shape exactly
    (restaurant_id, match_score, justification).
    """
    reconciled = _reconcile(state)
    state.reconciled = reconciled

    query_text = _build_query_text(reconciled, state)
    query_embedding = await embed_text(query_text)

    hits = await similarity_search(
        query_embedding,
        limit=_CANDIDATE_LIMIT,
        required_dietary_tags=reconciled.required_dietary or None,
        price_max=reconciled.price_max,
        center=reconciled.center,
        radius_miles=reconciled.radius_miles,
    )

    candidates = [
        CandidateRestaurant(
            id=restaurant.id,
            name=restaurant.name,
            cuisine_tags=list(restaurant.cuisine_tags or []),
            dietary_tags=list(restaurant.dietary_tags or []),
            price_avg=restaurant.price_avg,
            avg_rating=restaurant.avg_rating,
            distance=distance,
        )
        for restaurant, distance in hits
        if restaurant.id is not None
    ]
    state.candidates = candidates

    if not candidates:
        state.ranked = []
        return state

    messages = build_group_rerank_messages(
        reconciled=reconciled.model_dump(),
        candidates=[c.model_dump() for c in candidates],
    )
    # NOTE: do NOT pass response_format={"type": "json_object"} here. The active
    # Salesforce/Claude gateway does not honor OpenAI JSON mode and returns an
    # empty "{}" when it's set. The prompt already demands strict JSON and
    # `_parse_ranked` strips code fences, so plain completion is the robust path.
    raw = await chat_completion(messages, temperature=0.2)

    valid_ids = {c.id for c in candidates}
    ranked = _parse_ranked(raw or "", valid_ids)

    # Fallback: if the LLM returned nothing usable, rank by retrieval distance
    # so the pipeline still produces valid RecommendationItem-shaped output.
    if not ranked:
        ordered = sorted(
            candidates, key=lambda c: (c.distance if c.distance is not None else 1.0)
        )
        ranked = [
            RankedItem(
                restaurant_id=c.id,
                match_score=round(max(0.0, 1.0 - (c.distance or 0.0)), 4),
                justification="Ranked by embedding similarity (LLM re-rank unavailable).",
            )
            for c in ordered
        ]

    state.ranked = ranked
    return state
