import { create } from 'zustand'
import type { EventRecord } from '@/types'
import { fetchEvents } from '@/api/eventsApi'

// The Events-tab dining-history list. Separate from `eventStore` (the in-session
// order "cart"): this store holds the durable Event rows from GET /api/events and
// is refreshed live when a session:confirmed broadcast lands (see useSocket).
interface EventListState {
  events: EventRecord[]
  loaded: boolean
  loading: boolean
  load: () => Promise<void>
  // Optimistically place a just-created event at the top (session:confirmed).
  prepend: (event: EventRecord) => void
}

export const useEventListStore = create<EventListState>((set, get) => ({
  events: [],
  loaded: false,
  loading: false,

  load: async () => {
    if (get().loading) return
    set({ loading: true })
    try {
      const events = await fetchEvents()
      set({ events, loaded: true })
    } finally {
      set({ loading: false })
    }
  },

  // De-dupe by id so a prepend followed by a load() (or a repeat broadcast) can't
  // double-list the same event.
  prepend: (event) =>
    set((s) => ({
      events: [event, ...s.events.filter((e) => e.id !== event.id)],
    })),
}))
