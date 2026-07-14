"""Data access for users and profiles."""

from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.models.profile import Profile
from app.models.timestamps import utcnow


async def get_profile_by_user(db: AsyncSession, user_id: int) -> Profile | None:
    """Return the Profile row for a user id, or None."""
    result = await db.execute(select(Profile).where(Profile.user_id == user_id))
    return result.scalars().first()


# Durable Profile columns the conversational analyze flow may update. Scalars
# and lists are handled separately by the caller's diff (see below).
_PROFILE_LIST_FIELDS = (
    "dietary_restrictions",
    "preferred_cuisines",
    "disliked_cuisines",
)
_PROFILE_SCALAR_FIELDS = ("budget_min", "budget_max")


async def upsert_profile_signals(
    db: AsyncSession, user_id: int, diff: dict[str, Any]
) -> Profile | None:
    """Merge extracted durable-preference signals into a user's Profile row.

    `diff` carries only the fields to change: list fields
    (dietary_restrictions / preferred_cuisines / disliked_cuisines) REPLACE the
    stored list (the caller already reconciled corrections into a full list), and
    scalar budget_min/budget_max overwrite when present. Touches updated_at
    (app-filled, mirroring Prisma's @updatedAt — the mirror gets no client-side
    write magic). Returns the updated Profile, or None if the user has no Profile
    row yet (ai_service does not create Profiles — the gateway/Better-Auth path
    owns Profile creation, so a missing row is left for the gateway to persist).
    """
    profile = await get_profile_by_user(db, user_id)
    if profile is None:
        return None

    changed = False
    for field in _PROFILE_LIST_FIELDS:
        if field in diff and diff[field] is not None:
            setattr(profile, field, list(diff[field]))
            changed = True
    for field in _PROFILE_SCALAR_FIELDS:
        if field in diff and diff[field] is not None:
            setattr(profile, field, int(diff[field]))
            changed = True

    if not changed:
        return profile

    profile.updated_at = utcnow()
    db.add(profile)
    await db.commit()
    await db.refresh(profile)
    return profile
