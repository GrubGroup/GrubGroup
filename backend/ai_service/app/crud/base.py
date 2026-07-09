"""Generic async CRUD parameterized by model."""

from typing import Generic, TypeVar

from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import SQLModel, select

ModelT = TypeVar("ModelT", bound=SQLModel)


class CRUDBase(Generic[ModelT]):
    """Thin async data access (get / get_multi / create) for one SQLModel table."""

    def __init__(self, model: type[ModelT]) -> None:
        self.model = model

    async def get(self, db: AsyncSession, id: int) -> ModelT | None:
        """Return a single row by primary key, or None."""
        return await db.get(self.model, id)

    async def get_multi(
        self, db: AsyncSession, *, limit: int = 100, offset: int = 0
    ) -> list[ModelT]:
        """Return a page of rows."""
        result = await db.execute(select(self.model).offset(offset).limit(limit))
        return list(result.scalars().all())

    async def create(self, db: AsyncSession, obj: ModelT) -> ModelT:
        """Persist a new row and return it with DB-populated columns."""
        db.add(obj)
        await db.commit()
        await db.refresh(obj)
        return obj
