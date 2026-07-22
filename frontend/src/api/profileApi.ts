import type { Profile } from '@/types'
import { api } from '@/lib/axios'

// Returns null when the caller has no profile yet (gateway 404) — e.g. a
// brand-new signup before onboarding's first save. Callers seed a default.
export async function fetchProfile(): Promise<Profile | null> {
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
  // PUT /profile upserts (creates on first save, updates thereafter).
  const { data } = await api.put<Profile>('/profile', profile)
  return data
}
