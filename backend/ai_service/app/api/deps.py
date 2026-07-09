"""FastAPI dependencies: get_db_session, get_current_user, require_role(...).

Only the internal service-to-service guard is implemented so far; the DB/user
dependencies remain to be built as the read paths are added.
"""

from collections.abc import AsyncGenerator

from fastapi import Header, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.session import async_session_factory


async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    """Yield an async SQLModel session for FastAPI Depends, closed on request end."""
    async with async_session_factory() as session:
        yield session


async def require_internal_secret(
    x_internal_secret: str | None = Header(default=None),
) -> None:
    """Guard service-to-service endpoints with the shared internal secret.

    The gateway sends `X-Internal-Secret: <JWT_SECRET>`; reject anything else
    so /embed isn't openly callable.
    """
    if x_internal_secret != settings.jwt_secret:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing internal secret",
        )
