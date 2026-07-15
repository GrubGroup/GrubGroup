import type { LocationPref } from './qa'

// Modeled on Prisma `Profile`. `liked_restaurant_ids` is a denormalized int[]
// (no FK) — resolve against the restaurant store for display.
export interface Profile {
  id: number
  user_id: number
  dietary_restrictions: string[]
  disliked_cuisines: string[]
  preferred_cuisines: string[]
  budget_min: number
  budget_max: number
  // Durable default dining location. `default_location` is the display label;
  // lat/lon (optional) seed a session's Qa when the member doesn't override it.
  default_location?: string | null
  default_lat?: number | null
  default_lon?: number | null
  liked_restaurant_ids: number[]
  created_at: string
  updated_at: string
}

// CLIENT-SIDE location helper. The durable default now persists on `Profile`
// (default_location + optional lat/lon). This holds the richer in-flight
// `LocationPref` (mode/radius) the picker works with before it's flattened onto
// the profile; a session's `Qa` still owns per-session location.
export interface ProfilePreferencesClient {
  preferredLocation?: LocationPref
}
