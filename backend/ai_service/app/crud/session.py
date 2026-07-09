"""Data access for sessions and session members."""

from collections.abc import Sequence

from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.models.profile import Profile
from app.models.qa import Qa
from app.models.session import Session
from app.models.session_member import SessionMember


async def get_session(db: AsyncSession, session_id: int) -> Session | None:
    """Return a session by id, or None."""
    return await db.get(Session, session_id)


async def list_members(db: AsyncSession, session_id: int) -> list[SessionMember]:
    """Return all member rows for a session."""
    result = await db.execute(
        select(SessionMember).where(SessionMember.session_id == session_id)
    )
    return list(result.scalars().all())


async def list_confirmed_members(
    db: AsyncSession, session_id: int
) -> list[SessionMember]:
    """Return member rows whose status is True (confirmed) for a session."""
    result = await db.execute(
        select(SessionMember).where(
            SessionMember.session_id == session_id,
            SessionMember.status.is_(True),
        )
    )
    return list(result.scalars().all())


async def get_profiles_for_users(
    db: AsyncSession, user_ids: Sequence[int]
) -> list[Profile]:
    """Return profile rows for the given user ids."""
    if not user_ids:
        return []
    result = await db.execute(
        select(Profile).where(Profile.user_id.in_(user_ids))
    )
    return list(result.scalars().all())


async def get_qa(db: AsyncSession, session_id: int) -> Qa | None:
    """Return the earliest Qa row for a session, or None."""
    result = await db.execute(
        select(Qa)
        .where(Qa.session_id == session_id)
        .order_by(Qa.id)
        .limit(1)
    )
    return result.scalars().first()


async def all_members_confirmed(db: AsyncSession, session_id: int) -> bool:
    """Return True if the session has members and every one has status True."""
    members = await list_members(db, session_id)
    if not members:
        return False
    return all(member.status for member in members)
