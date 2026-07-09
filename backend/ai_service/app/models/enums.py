"""Shared enums mirroring Prisma: Role and MessageType."""

from enum import Enum


class Role(str, Enum):
    """User access level, mirrors Prisma enum Role."""

    USER = "USER"
    OWNER = "OWNER"
    ADMIN = "ADMIN"


class MessageType(str, Enum):
    """Group message kind, mirrors Prisma enum MessageType."""

    TEXT = "TEXT"
    IMG = "IMG"
    SYSTEM = "SYSTEM"
    SESSION_BLOCK = "SESSION_BLOCK"
