// Modeled on Prisma `Restaurant`.
export interface Restaurant {
  id: number
  name: string
  description?: string | null
  cuisine_tags: string[]
  dietary_tags: string[]
  price_avg?: number | null
  address?: string | null
  lat?: number | null
  long?: number | null
  hours?: string | null
  avg_rating?: number | null
  created_at: string
  updated_at: string
}
