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
  liked_restaurant_ids: number[]
  created_at: string
  updated_at: string
}

// CLIENT-ONLY: location is not a column on Prisma `Profile` (it lives on `Qa`
// per session). We keep a default location preference client-side and use it to
// seed a session's Qa later. Kept OUT of the wire `Profile` type on purpose.
export interface ProfilePreferencesClient {
  preferredLocation?: LocationPref
}
