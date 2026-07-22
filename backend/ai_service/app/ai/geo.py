"""Great-circle distance + between-host-and-member proximity scoring (D3).

The orchestrator ranks restaurants against two kinds of anchor: the HOST's
location (primary weight) and each MEMBER's preferred location (secondary). The
goal (per the approved design) is a tiered preference:

    between (on the corridor between host and a member)  >  host-proximate
        >  member-proximate  >  far

"Between" is detected with a **detour ratio**: a restaurant R sits between host H
and member M when going H -> R -> M is barely longer than going H -> M directly,
i.e. ``dist(H,R) + dist(R,M) <= detour_factor * dist(H,M)``. A factor of ~1.3
allows a modest detour off the straight line while still excluding places well
off to the side or far past either endpoint.

Distances use the haversine formula (miles). Pure and dependency-free so it is
trivially unit-testable; the orchestrator turns the tier into a numeric score
blended into the final ranking.
"""

from __future__ import annotations

import math

_EARTH_RADIUS_MILES = 3958.8

# A candidate counts as "between" host and a member when the H->R->M path is at
# most this multiple of the direct H->M distance. 1.0 would require R exactly on
# the straight line; 1.3 tolerates a reasonable detour.
_BETWEEN_DETOUR_FACTOR = 1.3

# Radii (miles) for the coarse "near an anchor" tiers when a candidate is not
# on any host<->member corridor.
_NEAR_HOST_MILES = 2.0
_NEAR_MEMBER_MILES = 2.0

Coord = tuple[float, float]


def haversine_miles(a: Coord, b: Coord) -> float:
    """Great-circle distance in miles between two (lat, lon) points."""
    lat1, lon1 = a
    lat2, lon2 = b
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    h = (
        math.sin(dphi / 2) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    )
    return 2 * _EARTH_RADIUS_MILES * math.asin(min(1.0, math.sqrt(h)))


def is_between(host: Coord, member: Coord, point: Coord, *, factor: float = _BETWEEN_DETOUR_FACTOR) -> bool:
    """True if ``point`` lies on the host<->member corridor (small detour ratio).

    Uses the triangle-inequality detour test: point P is "between" H and M when
    ``dist(H,P) + dist(P,M) <= factor * dist(H,M)``. When host and member are the
    same spot (dist ~ 0) there is no corridor, so this returns False (the
    host/member near-tiers handle that case).
    """
    direct = haversine_miles(host, member)
    if direct < 1e-6:
        return False
    detour = haversine_miles(host, point) + haversine_miles(point, member)
    return detour <= factor * direct


def proximity_tier(
    point: Coord | None,
    *,
    host: Coord | None,
    members: list[Coord],
) -> str:
    """Classify ``point`` into a between/host/member/far tier for ranking.

    Priority (highest first):
      * ``"between"`` — genuinely on the corridor between the host and ANY member:
        the H->point->M detour is small AND the point is not merely hugging one
        endpoint (excluded so it "serves both", not just one). This is the
        strongest signal.
      * ``"host"``    — within ``_NEAR_HOST_MILES`` of the host (primary anchor).
      * ``"member"``  — within ``_NEAR_MEMBER_MILES`` of ANY member (secondary).
      * ``"far"``     — none of the above (still a valid candidate, just no bonus).

    The endpoint exclusion matters: without it, every point near the host (the
    common case — the seed clusters downtown) would pass the detour test at the
    host endpoint (ratio ~1.0) and swamp the "between" tier. So a point close to
    the host is "host", close to a member is "member", and only a spot in the
    MIDDLE (near neither endpoint but on the line) earns "between".

    Degrades gracefully: no host anchor or no coords -> ``"far"``. No members ->
    only the host tier is reachable, the host-only fallback.
    """
    if point is None or host is None:
        return "far"

    near_host = haversine_miles(host, point) <= _NEAR_HOST_MILES
    near_member = any(
        haversine_miles(member, point) <= _NEAR_MEMBER_MILES for member in members
    )

    # "between" only when on the corridor AND not sitting on either endpoint.
    if not near_host and not near_member:
        for member in members:
            if is_between(host, member, point):
                return "between"

    if near_host:
        return "host"
    if near_member:
        return "member"
    return "far"


# Numeric bonus per tier, blended into the final match score. "between" is the
# strongest signal (host + a member both well served), then host (primary weight),
# then member (a consideration), then nothing.
TIER_BONUS: dict[str, float] = {
    "between": 0.20,
    "host": 0.12,
    "member": 0.06,
    "far": 0.0,
}
