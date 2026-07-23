"""Parse a restaurant's free-text ``hours`` string and evaluate open/closed.

``Restaurant.hours`` is a single unstructured string. The ai_service seed
(``scripts/seed_restaurants.py``) uses exactly one shape:

    "<DayStart>-<DayEnd> HH:MM-HH:MM"   e.g. "Mon-Sun 11:00-22:00"

with two load-bearing gotchas the parser must handle:

  * **Wrap-around day ranges.** ``Wed-Mon`` means Wed, Thu, Fri, Sat, Sun, Mon
    are open (Tue closed) — the start weekday index can exceed the end index and
    the span wraps through Sunday. ``Sun-Fri`` means Sun..Fri (Sat closed). A
    naive ``start <= end`` index comparison is WRONG.
  * **Overnight / midnight closes.** A close time of ``24:00`` (ai_service seed)
    or ``00:00`` (gateway seed) means the venue closes at/after midnight, i.e.
    the open interval runs past midnight into the next day. ``24:00`` is not a
    valid ``%H:%M`` value, so it is special-cased. When the parsed close time is
    ``<=`` the open time, the interval is treated as overnight (open ..24:00 that
    day, then 00:00.. close the next day).

**Philosophy: unknown/unparseable/null hours are treated as OPEN.** A restaurant
is only ever reported CLOSED when its hours parse cleanly AND the target time
falls outside the open interval — so a missing or oddly-formatted string (e.g.
the gateway seed's different shape) never wrongly hard-filters a venue out. This
keeps the open/closed hard filter (D4) conservative: it only removes places we
are confident are closed.

Pure, dependency-free, and framework-agnostic so it can back both the
orchestrator's hard filter and a display helper. The TypeScript sibling
(``frontend/src/utils/hours.ts``) mirrors this logic for the pick cards.
"""

from __future__ import annotations

from datetime import datetime

# Weekday abbreviations in Mon..Sun order, matching Python's date.weekday()
# (Mon == 0). The seed uses exactly these three-letter, title-case tokens.
_WEEKDAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]
_WEEKDAY_INDEX = {name: i for i, name in enumerate(_WEEKDAYS)}


def _parse_hhmm(token: str) -> int | None:
    """Parse ``HH:MM`` to minutes-since-midnight; ``24:00`` -> 1440. None if bad."""
    parts = token.strip().split(":")
    if len(parts) != 2:
        return None
    try:
        hh = int(parts[0])
        mm = int(parts[1])
    except ValueError:
        return None
    # 24:00 is a valid "midnight close" sentinel in the seed but not a real clock
    # time; map it to 1440 (end of day). Anything else must be a real HH:MM.
    if hh == 24 and mm == 0:
        return 1440
    if not (0 <= hh <= 23 and 0 <= mm <= 59):
        return None
    return hh * 60 + mm


def _open_weekdays(day_start: str, day_end: str) -> set[int] | None:
    """Expand a (possibly wrap-around) day range to the set of open weekday ids.

    ``Wed-Mon`` -> {wed, thu, fri, sat, sun, mon}; ``Mon-Sun`` -> all seven. A
    single day (``day_start == day_end``) is just that day. Returns None if either
    token is not a known weekday abbreviation.
    """
    start = _WEEKDAY_INDEX.get(day_start.strip().lower())
    end = _WEEKDAY_INDEX.get(day_end.strip().lower())
    if start is None or end is None:
        return None
    days: set[int] = set()
    i = start
    # Walk forward mod 7 from start until we pass end (inclusive), so a wrap-around
    # span like Wed(2)->Mon(0) covers 2,3,4,5,6,0.
    while True:
        days.add(i)
        if i == end:
            break
        i = (i + 1) % 7
    return days


def parse_hours(hours: str | None) -> tuple[set[int], int, int] | None:
    """Parse ``hours`` into (open_weekdays, open_min, close_min), or None.

    ``open_min`` / ``close_min`` are minutes since midnight. An overnight span
    (close_min <= open_min, or a 24:00 close) is left as-is; ``is_open_at``
    interprets it. Returns None when the string is absent or does not match the
    expected ``Days HH:MM-HH:MM`` shape (caller treats None as "unknown -> open").
    """
    if not hours or not isinstance(hours, str):
        return None
    tokens = hours.strip().split()
    if len(tokens) != 2:
        return None
    day_part, time_part = tokens

    day_bits = day_part.split("-")
    if len(day_bits) != 2:
        return None
    open_days = _open_weekdays(day_bits[0], day_bits[1])
    if not open_days:
        return None

    time_bits = time_part.split("-")
    if len(time_bits) != 2:
        return None
    open_min = _parse_hhmm(time_bits[0])
    close_min = _parse_hhmm(time_bits[1])
    if open_min is None or close_min is None:
        return None

    return (open_days, open_min, close_min)


def is_open_at(hours: str | None, when: datetime) -> bool:
    """Return True if the venue is open at ``when`` (conservative on unknowns).

    Unknown/unparseable/null hours -> True (never hard-filtered on missing data).
    Handles wrap-around day ranges and overnight closes: for an overnight span the
    venue is open from ``open_min`` to midnight on its open days, and from midnight
    to ``close_min`` on the day AFTER an open day.
    """
    parsed = parse_hours(hours)
    if parsed is None:
        return True  # unknown format / null -> treat as open (see module docstring)

    open_days, open_min, close_min = parsed
    weekday = when.weekday()  # Mon == 0, matches _WEEKDAYS ordering
    minute = when.hour * 60 + when.minute

    if close_min > open_min:
        # Normal same-day interval, e.g. 11:00-22:00.
        return weekday in open_days and open_min <= minute < close_min

    # Overnight span (close <= open, e.g. 18:00-02:00 or a 24:00 close treated as
    # 1440 which never hits this branch). Open in two pieces:
    #   - on an open day, from open_min to end-of-day, and
    #   - on the day after an open day, from midnight to close_min.
    if weekday in open_days and minute >= open_min:
        return True
    prev_day = (weekday - 1) % 7
    if prev_day in open_days and minute < close_min:
        return True
    return False
