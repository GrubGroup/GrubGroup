import type {
  AnalyzeResponse,
  AnalyzeTurnBody,
  CreateSessionBody,
  Recommendation,
  Session,
  SessionMember,
} from '@/types'
import { USE_MOCK } from '@/lib/env'
import { api } from '@/lib/axios'
import {
  MOCK_MEMBERS,
  MOCK_RECOMMENDATION,
  MOCK_SESSION,
} from './mock/session.mock'

export async function fetchSession(sessionId: number): Promise<{
  session: Session
  members: SessionMember[]
}> {
  if (USE_MOCK) {
    return { session: structuredClone(MOCK_SESSION), members: structuredClone(MOCK_MEMBERS) }
  }
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
  if (USE_MOCK) return structuredClone(MOCK_RECOMMENDATION)
  const { data } = await api.get<Recommendation>(`/sessions/${sessionId}/recommendations`)
  return data
}

// Host pre-session modal → create the session (server geocodes location_address,
// seeds the host's Qa row, stamps scheduled_for). Returns the created Session.
export async function createSession(body: CreateSessionBody): Promise<Session> {
  if (USE_MOCK) {
    // Synthesize a fresh session from the mock, carrying the modal answers so the
    // timer + host-only affordances have real values to render offline.
    return {
      ...structuredClone(MOCK_SESSION),
      id: MOCK_SESSION.id,
      time_limit: body.time_limit,
      group_id: body.group_id ?? MOCK_SESSION.group_id,
      scheduled_for:
        body.scheduled_for && body.scheduled_for !== 'now'
          ? body.scheduled_for
          : new Date().toISOString(),
      created_at: new Date().toISOString(),
      closed_at: null,
    }
  }
  const { data } = await api.post<Session>('/sessions', body)
  return data
}

// Set the caller's ready status. The gateway broadcasts session:member_done so
// every client's progress bar updates from the echo (not an optimistic flip).
export async function setReady(sessionId: number, status: boolean): Promise<void> {
  if (USE_MOCK) return
  await api.patch(`/sessions/${sessionId}/members/me`, { status })
}

// Trigger the group orchestrator. On success the gateway persists a SESSION_BLOCK
// group-chat message and broadcasts session:picks; the returned recommendation is
// also handed back here (used by the host-expiry mock fallback).
export async function generateRecommendation(
  sessionId: number,
  opts?: { forcePartial?: boolean },
): Promise<Recommendation> {
  if (USE_MOCK) return structuredClone(MOCK_RECOMMENDATION)
  const { data } = await api.post<Recommendation>(`/sessions/${sessionId}/recommendations`, {
    force_partial: opts?.forcePartial ?? false,
  })
  return data
}

// One QA sub-agent turn. `user_id` is intentionally NOT sent — the gateway
// injects the server-verified identity.
export async function analyzeTurn(
  sessionId: number,
  body: AnalyzeTurnBody,
): Promise<AnalyzeResponse> {
  if (USE_MOCK) return mockAnalyze(sessionId, body)
  const { data } = await api.post<AnalyzeResponse>(`/sessions/${sessionId}/analyze`, body)
  return data
}

// Validate + geocode a free-text address for the host modal. The Geocodio key
// stays server-side; a miss returns { ok:false } (still HTTP 200).
export async function geocodeAddress(
  address: string,
): Promise<{ ok: boolean; lat?: number; lon?: number }> {
  if (USE_MOCK) {
    // Offline: any non-empty address "resolves" to downtown SF so the modal flow
    // is exercisable without a geocoder.
    return address.trim()
      ? { ok: true, lat: 37.7749, lon: -122.4194 }
      : { ok: false }
  }
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
  if (USE_MOCK) {
    return {
      session: { ...structuredClone(MOCK_SESSION), closed_at: new Date().toISOString() },
      event: { restaurant_id: restaurantId },
    }
  }
  const { data } = await api.post<{ session: Session; event: unknown }>(
    `/sessions/${sessionId}/close`,
    { restaurant_id: restaurantId },
  )
  return data
}

// --- Mock analyze -----------------------------------------------------------
// Cycles canned replies (preserving the offline UX) while returning a plausible
// extracted-signals set so the "Noted so far" panel populates. Kept module-local
// so the live path stays a thin axios call.
const MOCK_REPLIES = [
  "Got it — I'm syncing that with the group now.",
  'Noted. Anything on the vibe — quick bite or sit-down?',
  'The host set the meeting spot. Want somewhere more convenient for you, or is theirs fine?',
  "Thanks! I think I have enough. I'll factor everything in.",
]
let mockReplyIdx = 0

// Reset the canned-reply cursor so a fresh session's mock conversation restarts
// from the opening prompt (called by chatStore.seed in mock mode).
export function resetMockAnalyze(): void {
  mockReplyIdx = 0
}

function mockAnalyze(sessionId: number, body: AnalyzeTurnBody): AnalyzeResponse {
  const reply = MOCK_REPLIES[Math.min(mockReplyIdx, MOCK_REPLIES.length - 1)]
  mockReplyIdx += 1
  const prior = body.current_signals ?? {}
  // Naively fold the message into signals so the noted panel shows progress.
  return {
    user_id: 1,
    session_id: sessionId,
    extracted_signals: {
      dietary_restrictions: prior.dietary_restrictions ?? [],
      preferred_cuisines: prior.preferred_cuisines ?? [],
      disliked_cuisines: prior.disliked_cuisines ?? [],
      budget_min: prior.budget_min ?? null,
      budget_max: prior.budget_max ?? null,
      occasion: prior.occasion ?? null,
      location_mode: prior.location_mode ?? null,
      location_label: prior.location_label ?? null,
      location_lat: prior.location_lat ?? null,
      location_lon: prior.location_lon ?? null,
      radius_miles: prior.radius_miles ?? null,
    },
    profile_updated: false,
    qa_updated: true,
    agent_reply: reply,
    missing_signals: mockReplyIdx >= MOCK_REPLIES.length ? [] : ['preferences'],
  }
}
