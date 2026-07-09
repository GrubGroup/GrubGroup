// Modeled on Prisma `Qa` — per-session preference intake (occasion, location, budget, time).
// NOTE: location officially lives HERE (per session), not on Profile.

export type LocationMode = 'named' | 'realtime' | 'unset'

export interface Qa {
  id: number
  session_id: number
  occasion?: string | null
  location_mode?: LocationMode | null
  location_lat?: number | null
  location_lon?: number | null
  radius_miles?: number | null
  time_slot?: string | null
  budget_min?: number | null
  budget_max?: number | null
  member_status?: string | null
}

// Client-side helper for a resolved location preference (used by the Profile
// LocationField as a default, and to seed a session's Qa later).
export interface LocationPref {
  mode: LocationMode
  label?: string
  lat?: number
  lon?: number
  radiusMiles?: number
}
