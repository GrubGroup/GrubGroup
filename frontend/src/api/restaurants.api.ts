import type { MenuItem, Restaurant } from '@/types'
import { USE_MOCK } from '@/lib/env'
import { api } from '@/lib/axios'
import { MOCK_MENUS, MOCK_RESTAURANTS } from './mock/restaurants.mock'

export async function fetchRestaurants(): Promise<Restaurant[]> {
  if (USE_MOCK) return structuredClone(MOCK_RESTAURANTS)
  const { data } = await api.get<Restaurant[]>('/restaurants')
  return data
}

// FRONTEND-ONLY menus (no DB table yet) — mock always.
export async function fetchMenu(restaurantId: number): Promise<MenuItem[]> {
  return structuredClone(MOCK_MENUS[restaurantId] ?? [])
}
