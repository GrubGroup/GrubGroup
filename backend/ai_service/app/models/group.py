"""SQLModel read-side mirror of Prisma table "Group"."""

from datetime import datetime

from sqlmodel import Field, SQLModel

from app.models.timestamps import utcnow


class Group(SQLModel, table=True):
    """Persistent group of users; mirrors Prisma model Group."""

    __tablename__ = "Group"

    id: int | None = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=utcnow)
    closed_at: datetime | None = None
    name: str
