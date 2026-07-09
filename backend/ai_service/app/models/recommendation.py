"""SQLModel read-side mirror of Prisma table "Recommendation"."""

from datetime import datetime

from sqlmodel import Field, SQLModel

from app.models.timestamps import utcnow


class Recommendation(SQLModel, table=True):
    """A recommendation result set for a session; mirrors Prisma model Recommendation."""

    __tablename__ = "Recommendation"

    id: int | None = Field(default=None, primary_key=True)
    session_id: int = Field(foreign_key="Session.id")
    created_at: datetime = Field(default_factory=utcnow)
