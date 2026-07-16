"""Forward geocoding (address -> lat/lon) via the Geocodio API.

Used by the conversational analyze flow to turn a member's named location into
coordinates. A generic HTTP utility (no LLM involvement), so it lives under
services/ rather than app/ai/.
"""

from functools import lru_cache

import httpx

from app.core.config import settings

# Geocodio v2 forward-geocoding; the version prefix is required.
_BASE_URL = "https://api.geocod.io/v2"
# Geocoding runs inside a user turn's persist step, so fail fast: an unreachable
# Geocodio degrades to null coords in a few seconds rather than stalling.
_TIMEOUT_SECONDS = 4.0


@lru_cache(maxsize=1)
def _client() -> httpx.AsyncClient:
    """Lazily build the Geocodio HTTP client."""
    return httpx.AsyncClient(base_url=_BASE_URL, timeout=_TIMEOUT_SECONDS)


async def geocode(address: str) -> tuple[float, float] | None:
    """Geocode a free-text address to ``(lat, lon)``, or ``None``.

    Degrades gracefully to ``None`` (never raises) so a missing key, an
    unmatched address, or a Geocodio outage leaves coordinates null instead of
    breaking the analyze turn. Callers still persist the address text.
    """
    if not settings.geocodio_api_key:
        return None
    if not isinstance(address, str) or not address.strip():
        return None

    try:
        response = await _client().get(
            "/geocode",
            params={"q": address, "api_key": settings.geocodio_api_key},
        )
        response.raise_for_status()
        results = response.json().get("results") or []
        # Results are ordered most-accurate-first; an unmatched address returns
        # a 200 with an empty list, so guard before reading location.
        if not results:
            return None
        location = results[0].get("location") or {}
        lat = location.get("lat")
        # Geocodio returns longitude as `lng`; the rest of the app uses `lon`.
        lon = location.get("lng")
        if lat is None or lon is None:
            return None
        return (lat, lon)
    except Exception:
        return None
