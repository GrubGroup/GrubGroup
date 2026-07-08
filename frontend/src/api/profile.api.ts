import type { Profile } from '@/types'
import { USE_MOCK } from '@/lib/env'
import { api } from '@/lib/axios'
import { MOCK_PROFILE } from './mock/profile.mock'

// Swap boundary: stores import from here, never from mock/* directly.
// Flip VITE_USE_MOCK=false to hit the real gateway with no store changes.

export async function fetchProfile(): Promise<Profile> {
  if (USE_MOCK) return structuredClone(MOCK_PROFILE)
  const { data } = await api.get<Profile>('/profiles/me')
  return data
}

export async function saveProfile(profile: Profile): Promise<Profile> {
  if (USE_MOCK) return structuredClone(profile)
  const { data } = await api.put<Profile>('/profiles/me', profile)
  return data
}
