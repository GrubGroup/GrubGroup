"""SQLModel read-side mirror of Prisma table "Qa"."""

from sqlalchemy import ARRAY, Column, String
from sqlmodel import Field, SQLModel


class Qa(SQLModel, table=True):
    """One member's session-scoped preference overrides; mirrors Prisma model Qa.

    There is one Qa row per (session, member) — keyed by the Prisma
    ``@@unique([session_id, user_id])``. Each row holds that member's TEMPORARY
    overrides for this session only (they outrank the durable Profile and are
    deleted when the Event is created). ``occasion`` and ``time_slot`` are
    HOST-ONLY: only the ``Session.host_user_id`` member's row carries them; a
    non-host's row leaves them null.
    """

    __tablename__ = "Qa"

    id: int | None = Field(default=None, primary_key=True)
    session_id: int = Field(foreign_key="Session.id")
    user_id: int = Field(foreign_key="User.id")
    # Session-scoped cuisine overrides (same array style as Profile).
    preferred_cuisines: list[str] = Field(
        default_factory=list, sa_column=Column(ARRAY(String))
    )
    disliked_cuisines: list[str] = Field(
        default_factory=list, sa_column=Column(ARRAY(String))
    )
    occasion: str | None = None  # host-only
    location_mode: str | None = None
    # Free-text address the member named; geocoded into location_lat/lon.
    location_address: str | None = None
    location_lat: float | None = None
    location_lon: float | None = None
    radius_miles: float | None = None
    time_slot: str | None = None  # host-only
    budget_min: int | None = None
    budget_max: int | None = None
    member_status: str | None = None
