"""Verify JWTs minted by the gateway (decode + validate only) and role helpers."""

import jwt

from app.core.config import settings


class TokenError(Exception):
    """Raised when a token is missing, malformed, or expired."""


def decode_token(token: str) -> dict:
    """Decode and validate a gateway-minted JWT.

    Returns the claims dict ({sub, userId, role, exp}). Raises TokenError on any
    invalid or expired token so callers can map it to a 401.
    """
    try:
        return jwt.decode(
            token,
            settings.JWT_SECRET,
            algorithms=[settings.JWT_ALGORITHM],
        )
    except jwt.PyJWTError as exc:
        raise TokenError(str(exc)) from exc
