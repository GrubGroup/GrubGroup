"""FastAPI dependencies: the internal service-to-service guard.

Only the internal service-to-service guard is implemented; end-user token
verification stays a stub (ai_service trusts the shared internal secret).
"""

from fastapi import Header, HTTPException, status

from app.core.config import settings


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
