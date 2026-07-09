"""Shared timestamp default for the SQLModel mirror.

Prisma fills `@default(now())` / `@updatedAt` columns in its client layer, and
several of those columns are `NOT NULL` with no usable DB default on the write
path (an explicit NULL from SQLModel defeats `DEFAULT CURRENT_TIMESTAMP`). So the
mirror supplies the value itself, exactly like Prisma Client does. Returns naive
UTC to match the `TIMESTAMP WITHOUT TIME ZONE` columns Prisma created.
"""

from datetime import datetime, timezone


def utcnow() -> datetime:
    """Current UTC time as a naive datetime (no tzinfo), for TIMESTAMP columns."""
    return datetime.now(timezone.utc).replace(tzinfo=None)
