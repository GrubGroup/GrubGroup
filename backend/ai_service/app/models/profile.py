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
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)
    liked_restaurant_ids: list[int] = Field(
        default_factory=list, sa_column=Column(ARRAY(Integer))
    )
