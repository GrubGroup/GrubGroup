import type { EventRecord } from '@/types'
import { api } from '@/lib/axios'

// The caller's dining history — GET /api/events (gateway `listEvents`), newest
// first.
export async function fetchEvents(): Promise<EventRecord[]> {
  const { data } = await api.get<EventRecord[]>('/events')
  return data
}
