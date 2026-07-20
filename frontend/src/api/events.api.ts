import type { EventRecord } from '@/types'
import { USE_MOCK } from '@/lib/env'
import { api } from '@/lib/axios'
import { PAST_EVENTS, UPCOMING_EVENTS } from './mock/events.mock'

// The caller's dining history — GET /api/events (gateway `listEvents`), newest
// first. In mock mode we adapt the presentation fixtures (EventLite) to the real
// API row shape (EventRecord) so the live Events tab renders identically offline.
export async function fetchEvents(): Promise<EventRecord[]> {
  if (USE_MOCK) {
    return [...UPCOMING_EVENTS, ...PAST_EVENTS].map((e) => ({
      id: e.id,
      date: e.date,
      address: null,
      lat: null,
      lon: null,
      restaurant_id: e.restaurantId,
      restaurant_name: e.restaurantName,
      occasion: e.group,
      time_slot: e.time ?? e.date,
      group_id: null,
      group_name: e.group,
    }))
  }
  const { data } = await api.get<EventRecord[]>('/events')
  return data
}
