"""SQLModel read-side mirror of Prisma table "Session"."""

from datetime import datetime

from sqlmodel import Field, SQLModel

from app.models.timestamps import utcnow


class Session(SQLModel, table=True):
    """Group recommendation session; mirrors Prisma model Session."""

    __tablename__ = "Session"

    id: int | None = Field(default=None, primary_key=True)
    host_user_id: int = Field(foreign_key="User.id")
    group_id: int | None = Field(default=None, foreign_key="Group.id")
    time_limit: int
    created_at: datetime = Field(default_factory=utcnow)
    closed_at: datetime | None = None
    avg_budget: float
