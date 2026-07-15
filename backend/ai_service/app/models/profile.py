"""SQLModel read-side mirror of Prisma table "Profile"."""

from datetime import datetime

from sqlalchemy import ARRAY, Column, Integer, String
from sqlmodel import Field, SQLModel

from app.models.timestamps import utcnow


class Profile(SQLModel, table=True):
    """Per-user preference profile; mirrors Prisma model Profile."""

    __tablename__ = "Profile"

    id: int | None = Field(default=None, primary_key=True)
    user_id: int = Field(unique=True, foreign_key="User.id")
    dietary_restrictions: list[str] = Field(
        default_factory=list, sa_column=Column(ARRAY(String))
    )
    disliked_cuisines: list[str] = Field(
        default_factory=list, sa_column=Column(ARRAY(String))
    )
    preferred_cuisines: list[str] = Field(
        default_factory=list, sa_column=Column(ARRAY(String))
    )
    budget_min: int
    budget_max: int
    # Durable default dining location (mirrors Prisma Profile). label for display;
    # lat/lon optionally seed a session's Qa coordinates. All nullable.
    default_location: str | None = None
    default_lat: float | None = None
    default_lon: float | None = None
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)
    liked_restaurant_ids: list[int] = Field(
        default_factory=list, sa_column=Column(ARRAY(Integer))
    )
