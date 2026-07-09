"""FastAPI dependencies: get_db_session, get_current_user, require_role(...)."""

from dataclasses import dataclass

from fastapi import Depends, Header, HTTPException, status

from app.core.security import TokenError, decode_token


@dataclass
class CurrentUser:
    """The authenticated principal resolved from a gateway-minted JWT."""

    user_id: int
    role: str


def get_current_user(authorization: str = Header(default="")) -> CurrentUser:
    """Resolve the current user from the ``Authorization: Bearer <jwt>`` header.

    The gateway forwards the caller's JWT on proxied requests; we verify it with
    the shared secret. Raises 401 on any missing/invalid/expired token.
    """
    scheme, _, token = authorization.partition(" ")
    if scheme != "Bearer" or not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or malformed Authorization header.",
        )
    try:
        claims = decode_token(token)
    except TokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token.",
        )

    user_id = claims.get("userId")
    role = claims.get("role")
    if user_id is None or role is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token is missing required claims.",
        )
    return CurrentUser(user_id=int(user_id), role=str(role))


def require_role(*roles: str):
    """Dependency factory: require the current user to hold one of ``roles``."""

    def _guard(user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
        if user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Forbidden.",
            )
        return user

    return _guard


# get_db_session lives with the DB layer (app/db/session.py), which is owned by
# the data-layer track and still stubbed — wire it here when it lands.
