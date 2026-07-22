import { create } from 'zustand'
import type { MenuItem, Restaurant } from '@/types'
import { fetchMenu, fetchRestaurants } from '@/api/restaurantsApi'

interface RestaurantState {
  byId: Record<number, Restaurant>
  menus: Record<number, MenuItem[]>
  loaded: boolean
  load: () => Promise<void>
  loadMenu: (restaurantId: number) => Promise<void>
}

export const useRestaurantStore = create<RestaurantState>((set, get) => ({
  byId: {},
  menus: {},
  loaded: false,

  load: async () => {
    const list = await fetchRestaurants()
    const byId: Record<number, Restaurant> = {}
    for (const r of list) byId[r.id] = r
    set({ byId, loaded: true })
  },

  loadMenu: async (restaurantId) => {
    if (get().menus[restaurantId]) return
    const items = await fetchMenu(restaurantId)
    set((s) => ({ menus: { ...s.menus, [restaurantId]: items } }))
  },
}))
