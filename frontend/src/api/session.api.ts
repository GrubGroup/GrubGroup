import type { Recommendation, Session, SessionMember } from '@/types'
import { USE_MOCK } from '@/lib/env'
import { api } from '@/lib/axios'
import { MOCK_MEMBERS, MOCK_RECOMMENDATION, MOCK_SESSION } from './mock/session.mock'

export async function fetchSession(sessionId: number): Promise<{
  session: Session
  members: SessionMember[]
}> {
  if (USE_MOCK) {
    return { session: structuredClone(MOCK_SESSION), members: structuredClone(MOCK_MEMBERS) }
  }
  const { data } = await api.get<{ session: Session; members: SessionMember[] }>(
    `/sessions/${sessionId}`,
  )
  return data
}

export async function fetchRecommendation(sessionId: number): Promise<Recommendation> {
  if (USE_MOCK) return structuredClone(MOCK_RECOMMENDATION)
  const { data } = await api.get<Recommendation>(`/sessions/${sessionId}/recommendation`)
  return data
}
