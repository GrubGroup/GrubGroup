import type { Profile } from '@/types'
import { USE_MOCK } from '@/lib/env'
import { api } from '@/lib/axios'
import { MOCK_PROFILE } from './mock/profileMock'

// Swap boundary: stores import from here, never from mock/* directly.
// Flip VITE_USE_MOCK=false to hit the real gateway with no store changes.

// Returns null when the caller has no profile yet (gateway 404) — e.g. a
// brand-new signup before onboarding's first save. Callers seed a default.
export async function fetchProfile(): Promise<Profile | null> {
  if (USE_MOCK) return structuredClone(MOCK_PROFILE)
  // Gateway mounts profile routes at /profile (GET /).
  try {
    const { data } = await api.get<Profile>('/profile')
    return data
  } catch (err) {
    if ((err as { response?: { status?: number } })?.response?.status === 404) return null
    throw err
  }
}

export async function saveProfile(profile: Profile): Promise<Profile> {
  if (USE_MOCK) return structuredClone(profile)
  // PUT /profile upserts (creates on first save, updates thereafter).
  const { data } = await api.put<Profile>('/profile', profile)
  return data
}
