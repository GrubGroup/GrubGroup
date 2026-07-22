import type { MenuItem, Restaurant } from '@/types'
import { api } from '@/lib/axios'

export async function fetchRestaurants(): Promise<Restaurant[]> {
  // Ask for the whole catalog (gateway caps at 100; the seed is ~54–67 rows).
  // Without an explicit limit the gateway defaults to 20, so any recommended
  // restaurant with id > 20 would be absent from restaurantStore.byId and the
  // Top Picks page would silently drop every such pick → "No matching spots".
  const { data } = await api.get<Restaurant[]>('/restaurants', { params: { limit: 100 } })
  return data
}

// Menus have no backend table yet, so there is nothing to fetch — return empty.
// The restaurantId param is kept for call-site compatibility (store.loadMenu).
export async function fetchMenu(restaurantId: number): Promise<MenuItem[]> {
  void restaurantId
  return []
}
