"""Convenience entrypoint shim. Canonical command: `uvicorn app.main:app`."""

from app.main import app

__all__ = ["app"]
