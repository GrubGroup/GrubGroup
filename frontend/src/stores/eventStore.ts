import { create } from 'zustand'
import type { EventItem, MenuItem } from '@/types'

interface EventState {
  items: EventItem[]
  add: (item: MenuItem, userId: number) => void
  remove: (menuItemId: number) => void
  updateQty: (menuItemId: number, quantity: number) => void
  total: () => number
  clear: () => void
}

export const useEventStore = create<EventState>((set, get) => ({
  items: [],

  add: (item, userId) => {
    set((s) => {
      const existing = s.items.find((i) => i.menuItemId === item.id)
      if (existing) {
        return {
          items: s.items.map((i) =>
            i.menuItemId === item.id ? { ...i, quantity: i.quantity + 1 } : i,
          ),
        }
      }
      const line: EventItem = {
        menuItemId: item.id,
        restaurantId: item.restaurant_id,
        name: item.name,
        price: item.price,
        quantity: 1,
        addedByUserId: userId,
      }
      return { items: [...s.items, line] }
    })
  },

  remove: (menuItemId) => set((s) => ({ items: s.items.filter((i) => i.menuItemId !== menuItemId) })),

  updateQty: (menuItemId, quantity) => {
    if (quantity <= 0) {
      get().remove(menuItemId)
      return
    }
    set((s) => ({
      items: s.items.map((i) => (i.menuItemId === menuItemId ? { ...i, quantity } : i)),
    }))
  },

  total: () => get().items.reduce((sum, i) => sum + i.price * i.quantity, 0),

  clear: () => set({ items: [] }),
}))
