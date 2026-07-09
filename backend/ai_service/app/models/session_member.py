"""SQLModel read-side mirror of Prisma join table "SessionMember" (composite PK)."""

from datetime import datetime

from sqlmodel import Field, SQLModel

from app.models.timestamps import utcnow


class SessionMember(SQLModel, table=True):
    """Per-member session membership; mirrors Prisma model SessionMember."""

    __tablename__ = "SessionMember"

    session_id: int = Field(primary_key=True, foreign_key="Session.id")
    user_id: int = Field(primary_key=True, foreign_key="User.id")
    status: bool = Field(default=False)
    joined_at: datetime = Field(default_factory=utcnow)
