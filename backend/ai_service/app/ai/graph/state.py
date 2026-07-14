"""Typed LangGraph state for the preference -> reconcile -> re-rank pipeline."""

from __future__ import annotations

from operator import add
from typing import Annotated, Any

from pydantic import BaseModel, Field


class MemberPref(BaseModel):
    """Normalized per-member preferences: durable Profile + session Qa overrides.

    The `*` fields (no prefix) are the durable Prisma `Profile` columns. The
    `qa_*` fields are this member's TEMPORARY, session-scoped overrides from
    their Qa row — they OUTRANK the Profile for this session only (e.g. profile
    likes japanese but qa says mexican -> mexican wins this session, japanese
    still counted). A `qa_*` value of None/[] means "the member didn't override
    it in QA", so the durable Profile value stands. (There is no noise_tolerance
    or allergies signal in the schema, so none is modeled here.)
    """

    user_id: int
    dietary_restrictions: list[str] = Field(default_factory=list)
    preferred_cuisines: list[str] = Field(default_factory=list)
    disliked_cuisines: list[str] = Field(default_factory=list)
    budget_min: int = 0
    budget_max: int = 0
    liked_restaurant_ids: list[int] = Field(default_factory=list)
    # Session-scoped Qa overrides (None/[] => fall back to the Profile value).
    qa_preferred_cuisines: list[str] = Field(default_factory=list)
    qa_disliked_cuisines: list[str] = Field(default_factory=list)
    qa_budget_min: int | None = None
    qa_budget_max: int | None = None

    @property
    def effective_budget_max(self) -> int:
        """QA budget cap if the member set one this session, else the Profile's."""
        return self.qa_budget_max if self.qa_budget_max is not None else self.budget_max


class QaSignals(BaseModel):
    """Session-level (host-authored) Q&A signals; the shared event context.

    Per-member overrides (budget, cuisines) live on MemberPref, not here — this
    carries only the signals that are one-per-session: occasion / time_slot
    (HOST-ONLY) and the resolved group search location.
    """

    occasion: str | None = None
    location_mode: str | None = None
    location_lat: float | None = None
    location_lon: float | None = None
    radius_miles: float | None = None
    time_slot: str | None = None


class ReconciledConstraints(BaseModel):
    """Merged group constraints produced by the orchestrator's reconcile step."""

    required_dietary: list[str] = Field(default_factory=list)
    price_max: float | None = None
    # Mean of members' effective budget_max — the group's budget "sweet spot",
    # computed in code (there is no Session.avg_budget column) and handed to the
    # re-rank step so top picks land near what the group typically spends.
    avg_budget: float | None = None
    center: tuple[float, float] | None = None
    radius_miles: float | None = None
    # cuisine -> weight; preferred cuisines score positive, disliked negative.
    cuisine_weights: dict[str, float] = Field(default_factory=dict)


class CandidateRestaurant(BaseModel):
    """A retrieved restaurant payload passed to the LLM re-rank step."""

    id: int
    name: str
    cuisine_tags: list[str] = Field(default_factory=list)
    dietary_tags: list[str] = Field(default_factory=list)
    price_avg: float | None = None
    avg_rating: float | None = None
    # Cosine distance from the reconciled query embedding (lower = closer).
    distance: float | None = None


class RankedItem(BaseModel):
    """A ranked pick shaped EXACTLY like the `RecommendationItem` table row."""

    restaurant_id: int
    match_score: float
    justification: str


class PipelineState(BaseModel):
    """LangGraph state threaded through the two-agent recommendation pipeline.

    `members` uses an additive reducer so the fan-out preference nodes (one
    `Send` per member) converge their single-element outputs into one list.
    `raw_profiles` is graph input only (the source rows the fan-out router maps
    over); it is not part of the persisted recommendation DTO.
    """

    session_id: int
    # Source Profile payloads the START router fans out over. Declared on the
    # state schema so LangGraph carries it into the router; consumed by the
    # preference nodes and never persisted.
    raw_profiles: list[dict[str, Any]] = Field(default_factory=list)
    members: Annotated[list[MemberPref], add] = Field(default_factory=list)
    qa: QaSignals = Field(default_factory=QaSignals)
    reconciled: ReconciledConstraints | None = None
    candidates: list[CandidateRestaurant] = Field(default_factory=list)
    ranked: list[RankedItem] = Field(default_factory=list)
