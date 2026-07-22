import type {
  AnalyzeResponse,
  AnalyzeTurnBody,
  CreateSessionBody,
  Recommendation,
  Session,
  SessionMember,
} from '@/types'
import { api } from '@/lib/axios'

export async function fetchSession(sessionId: number): Promise<{
  session: Session
  members: SessionMember[]
}> {
  // The gateway's getSession returns a FLAT object — the session's own columns at
  // top level PLUS a `members` array (res.json({ ...session, members })). Split
  // `members` off so the store gets the { session, members } shape it expects.
  const { data } = await api.get<Session & { members: SessionMember[] }>(
    `/sessions/${sessionId}`,
  )
  const { members, ...session } = data
  return { session, members: members ?? [] }
}

// Read the latest stored recommendation (gateway-direct Prisma read). NOTE the
// PLURAL path — the gateway exposes GET /sessions/:id/recommendations
// (getLatestRecommendation); the old singular path was a 404.
export async function fetchRecommendation(sessionId: number): Promise<Recommendation> {
  const { data } = await api.get<Recommendation>(`/sessions/${sessionId}/recommendations`)
  return data
}

// Host pre-session modal → create the session (server geocodes location_address,
// seeds the host's Qa row, stamps scheduled_for). Returns the created Session.
export async function createSession(body: CreateSessionBody): Promise<Session> {
  const { data } = await api.post<Session>('/sessions', body)
  return data
}

// Set the caller's ready status. The gateway broadcasts session:member_done so
// every client's progress bar updates from the echo (not an optimistic flip).
export async function setReady(sessionId: number, status: boolean): Promise<void> {
  await api.patch(`/sessions/${sessionId}/members/me`, { status })
}

// Trigger the group orchestrator. On success the gateway persists a SESSION_BLOCK
// group-chat message and broadcasts session:picks; the returned recommendation is
// also handed back here (used by the host-expiry fallback).
export async function generateRecommendation(
  sessionId: number,
  opts?: { forcePartial?: boolean },
): Promise<Recommendation> {
  const { data } = await api.post<Recommendation>(`/sessions/${sessionId}/recommendations`, {
    force_partial: opts?.forcePartial ?? false,
  })
  return data
}

// One QA sub-agent turn. `user_id` is intentionally NOT sent — the gateway
// injects the server-verified identity. The gateway derives host-ness server-side
// from session.host_user_id.
export async function analyzeTurn(
  sessionId: number,
  body: AnalyzeTurnBody,
): Promise<AnalyzeResponse> {
  const { data } = await api.post<AnalyzeResponse>(`/sessions/${sessionId}/analyze`, body)
  return data
}

// Validate + geocode a free-text address for the host modal. The Geocodio key
// stays server-side; a miss returns { ok:false } (still HTTP 200).
export async function geocodeAddress(
  address: string,
): Promise<{ ok: boolean; lat?: number; lon?: number }> {
  const { data } = await api.post<{ ok: boolean; lat?: number; lon?: number }>('/geocode', {
    address,
  })
  return data
}

// Host confirms the chosen restaurant → creates the Event (gateway sources
// date/time/location from the session + host Qa) and broadcasts session:confirmed.
export async function closeSession(
  sessionId: number,
  restaurantId: number,
): Promise<{ session: Session; event: unknown }> {
  const { data } = await api.post<{ session: Session; event: unknown }>(
    `/sessions/${sessionId}/close`,
    { restaurant_id: restaurantId },
  )
  return data
}
