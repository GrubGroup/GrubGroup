"""Restaurant data access including pgvector similarity and tag/geo filters."""

from collections.abc import Sequence

from sqlalchemy import func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.models.restaurant import Restaurant


async def get_by_ids(db: AsyncSession, ids: Sequence[int]) -> list[Restaurant]:
    """Return restaurant rows for the given ids."""
    if not ids:
        return []
    result = await db.execute(
        select(Restaurant).where(Restaurant.id.in_(ids))
    )
    return list(result.scalars().all())


async def count(db: AsyncSession) -> int:
    """Return the total number of restaurants."""
    result = await db.execute(select(func.count()).select_from(Restaurant))
    return result.scalar_one()


async def count_with_embedding(db: AsyncSession) -> int:
    """Return the number of restaurants that have an embedding set."""
    result = await db.execute(
        select(func.count())
        .select_from(Restaurant)
        .where(Restaurant.embedding.is_not(None))
    )
    return result.scalar_one()
