"""SQLModel read-side mirror of Prisma table "Qa"."""

from sqlmodel import Field, SQLModel


class Qa(SQLModel, table=True):
    """Session Q&A / extracted preference signals; mirrors Prisma model Qa."""

    __tablename__ = "Qa"

    id: int | None = Field(default=None, primary_key=True)
    session_id: int = Field(foreign_key="Session.id")
    occasion: str | None = None
    location_mode: str | None = None
    location_lat: float | None = None
    location_lon: float | None = None
    radius_miles: float | None = None
    time_slot: str | None = None
    budget_min: int | None = None
    budget_max: int | None = None
    member_status: str | None = None
