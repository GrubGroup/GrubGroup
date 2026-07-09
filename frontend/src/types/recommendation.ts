import type { Restaurant } from './restaurant'

// Modeled on Prisma `Recommendation` + `RecommendationItem`.
export interface RecommendationItem {
  id: number
  recommendation_id: number
  restaurant_id: number
  match_score?: number | null
  justification?: string | null
}

export interface Recommendation {
  id: number
  session_id: number
  created_at: string
  items: RecommendationItem[]
}

// VIEW TYPE (not persisted): a recommendation item joined with its restaurant
// and the live vote count, composed in the store for the TopPicks UI.
export interface RankedPick extends RecommendationItem {
  restaurant: Restaurant
  voteCount: number
}
