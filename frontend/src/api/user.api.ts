import type { User } from '@/types'
import { USE_MOCK } from '@/lib/env'
import { api } from '@/lib/axios'
import { MOCK_USER } from './mock/profile.mock'

// Swap boundary for the caller's own User account (identity fields shown on the
// profile header). Auth credentials (email/password) are owned by Better Auth
// and are NOT edited through here. Stores import from here, never from mock/*.

export interface UpdateUserInput {
  display_name?: string | null
  username?: string
}

// Thrown when the gateway rejects an update (e.g. 409 username taken). Carries
// the HTTP status so callers can branch on conflicts vs. other failures.
export class UserUpdateError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'UserUpdateError'
    this.status = status
  }
}

export async function fetchMe(): Promise<User> {
  if (USE_MOCK) return structuredClone(MOCK_USER)
  const { data } = await api.get<User>('/user/me')
  return data
}

export async function updateMe(input: UpdateUserInput): Promise<User> {
  if (USE_MOCK) return { ...structuredClone(MOCK_USER), ...input }
  try {
    const { data } = await api.patch<User>('/user', input)
    return data
  } catch (err) {
    // Surface the gateway's { error } message + status (409 = username taken).
    const status = (err as { response?: { status?: number } })?.response?.status ?? 0
    const message =
      (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
      'Could not update your profile. Please try again.'
    throw new UserUpdateError(message, status)
  }
}
