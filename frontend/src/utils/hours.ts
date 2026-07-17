// TypeScript sibling of the ai_service hours parser
// (backend/ai_service/app/ai/hours.py). Mirrors its logic exactly so the pick
// cards show the SAME open/closed verdict the orchestrator used for its
// hard-filter — no drift between what was filtered and what the badge shows.
//
// `Restaurant.hours` is a single unstructured string in one seed shape:
//     "<DayStart>-<DayEnd> HH:MM-HH:MM"   e.g. "Mon-Sun 11:00-22:00"
//
// Two load-bearing gotchas (see hours.py for the full rationale):
//   * Wrap-around day ranges — "Wed-Mon" = Wed,Thu,Fri,Sat,Sun,Mon (Tue closed).
//     A naive start<=end index comparison is WRONG.
//   * Overnight / midnight closes — "24:00" (ai_service seed) or a close <= open
//     means the interval runs past midnight into the next day.
//
// Philosophy: unknown / unparseable / null hours are treated as OPEN. A venue is
// only ever reported CLOSED when its hours parse cleanly AND the target time
// falls outside the open interval — so a missing/odd string never wrongly marks
// a place closed.

// Weekday abbreviations in Mon..Sun order, matching Python's date.weekday()
// (Mon == 0). The seed uses exactly these three-letter, lower-cased tokens.
const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
const WEEKDAY_INDEX: Record<string, number> = Object.fromEntries(
  WEEKDAYS.map((name, i) => [name, i]),
)

interface ParsedHours {
  openDays: Set<number>
  openMin: number
  closeMin: number
}

// Parse "HH:MM" to minutes-since-midnight; "24:00" -> 1440. null if malformed.
function parseHhmm(token: string): number | null {
  const parts = token.trim().split(':')
  if (parts.length !== 2) return null
  const hh = Number(parts[0])
  const mm = Number(parts[1])
  if (!Number.isInteger(hh) || !Number.isInteger(mm)) return null
  // 24:00 is a valid "midnight close" sentinel in the seed but not a real clock
  // time; map it to 1440 (end of day). Anything else must be a real HH:MM.
  if (hh === 24 && mm === 0) return 1440
  if (!(hh >= 0 && hh <= 23 && mm >= 0 && mm <= 59)) return null
  return hh * 60 + mm
}

// Expand a (possibly wrap-around) day range to the set of open weekday ids.
// "Wed-Mon" -> {wed,thu,fri,sat,sun,mon}; "Mon-Sun" -> all seven. null if a
// token is not a known weekday abbreviation.
function openWeekdays(dayStart: string, dayEnd: string): Set<number> | null {
  const start = WEEKDAY_INDEX[dayStart.trim().toLowerCase()]
  const end = WEEKDAY_INDEX[dayEnd.trim().toLowerCase()]
  if (start === undefined || end === undefined) return null
  const days = new Set<number>()
  let i = start
  // Walk forward mod 7 from start until we pass end (inclusive), so a wrap-around
  // span like Wed(2)->Mon(0) covers 2,3,4,5,6,0.
  for (;;) {
    days.add(i)
    if (i === end) break
    i = (i + 1) % 7
  }
  return days
}

// Parse `hours` into { openDays, openMin, closeMin }, or null. An overnight span
// (closeMin <= openMin, or a 24:00 close) is left as-is; isOpenAt interprets it.
// null when absent or not the expected "Days HH:MM-HH:MM" shape (treated as open).
export function parseHours(hours: string | null | undefined): ParsedHours | null {
  if (!hours || typeof hours !== 'string') return null
  const tokens = hours.trim().split(/\s+/)
  if (tokens.length !== 2) return null
  const [dayPart, timePart] = tokens

  const dayBits = dayPart.split('-')
  if (dayBits.length !== 2) return null
  const openDays = openWeekdays(dayBits[0], dayBits[1])
  if (!openDays || openDays.size === 0) return null

  const timeBits = timePart.split('-')
  if (timeBits.length !== 2) return null
  const openMin = parseHhmm(timeBits[0])
  const closeMin = parseHhmm(timeBits[1])
  if (openMin === null || closeMin === null) return null

  return { openDays, openMin, closeMin }
}

// True if the venue is open at `when` (conservative on unknowns → open).
// Handles wrap-around day ranges and overnight closes: for an overnight span the
// venue is open from openMin to midnight on its open days, and from midnight to
// closeMin on the day AFTER an open day.
export function isOpenAt(hours: string | null | undefined, when: Date): boolean {
  const parsed = parseHours(hours)
  if (parsed === null) return true // unknown format / null -> treat as open

  const { openDays, openMin, closeMin } = parsed
  // JS getDay() is Sun==0..Sat==6; remap to Mon==0 to match WEEKDAYS ordering.
  const weekday = (when.getDay() + 6) % 7
  const minute = when.getHours() * 60 + when.getMinutes()

  if (closeMin > openMin) {
    // Normal same-day interval, e.g. 11:00-22:00.
    return openDays.has(weekday) && minute >= openMin && minute < closeMin
  }

  // Overnight span (close <= open). Open in two pieces:
  //   - on an open day, from openMin to end-of-day, and
  //   - on the day after an open day, from midnight to closeMin.
  if (openDays.has(weekday) && minute >= openMin) return true
  const prevDay = (weekday - 1 + 7) % 7
  if (openDays.has(prevDay) && minute < closeMin) return true
  return false
}

// Return the raw hours string for display, or null when absent. A thin
// passthrough (seed strings are already human-readable); kept as a seam.
export function formatHours(hours: string | null | undefined): string | null {
  if (!hours || typeof hours !== 'string' || !hours.trim()) return null
  return hours.trim()
}
