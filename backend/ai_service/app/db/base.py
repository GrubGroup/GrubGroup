"""Imports every model module so SQLModel.metadata is fully registered (no create_all)."""

from app.models import (  # noqa: F401
    Group,
    Profile,
    Qa,
    Recommendation,
    RecommendationItem,
    Restaurant,
    Session,
    SessionMember,
    User,
)
