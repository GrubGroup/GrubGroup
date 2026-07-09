"""SQLModel read-side mirror of Prisma table "Restaurant" (incl. pgvector embedding)."""

from datetime import datetime

from pgvector.sqlalchemy import Vector
from sqlalchemy import ARRAY, Column, String
from sqlmodel import Field, SQLModel

from app.models.timestamps import utcnow


class Restaurant(SQLModel, table=True):
    """Restaurant with tags, geo, and embedding; mirrors Prisma model Restaurant."""

    __tablename__ = "Restaurant"

    id: int | None = Field(default=None, primary_key=True)
    name: str
    description: str | None = None
    cuisine_tags: list[str] = Field(
        default_factory=list, sa_column=Column(ARRAY(String))
    )
    dietary_tags: list[str] = Field(
        default_factory=list, sa_column=Column(ARRAY(String))
    )
    price_avg: float | None = None
    address: str | None = None
    lat: float | None = None
    long: float | None = None
    hours: str | None = None
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)
    avg_rating: float | None = None
    embedding: list[float] | None = Field(
        default=None, sa_column=Column(Vector(1024))
    )
