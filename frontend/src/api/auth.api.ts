import { USE_MOCK } from '@/lib/env'
import { api } from '@/lib/axios'

// Which auth providers an email is registered with. Public (pre-login) lookup
// used by the sign-in/up form to nudge a Google-only email toward Google
// instead of failing a password attempt.
export interface AuthMethods {
  google: boolean
  password: boolean
  exists: boolean
}

export async function fetchAuthMethods(email: string): Promise<AuthMethods> {
  // Mock mode has no gateway — report "unknown" so flows are unaffected.
  if (USE_MOCK) return { google: false, password: false, exists: false }
  const { data } = await api.get<AuthMethods>('/auth-methods', { params: { email } })
  return data
}
