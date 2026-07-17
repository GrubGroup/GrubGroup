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
    # The host's chosen event time (from the pre-session modal). Drives restaurant
    # open/closed evaluation in the orchestrator; snapshotted onto Event.date at
    # close. Replaces the removed host Qa.time_slot free-text field.
    scheduled_for: datetime | None = None
    created_at: datetime = Field(default_factory=utcnow)
    closed_at: datetime | None = None
    # No avg_budget column: the averaged group budget is computed on demand from
    # members' effective budget_max by the orchestrator, never persisted.
