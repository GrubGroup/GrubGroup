import type { User } from '@/types'
import { api } from '@/lib/axios'

// Auth calls to the gateway. Each returns { token, user }; the caller feeds that
// into authStore.login (which stores the token and decodes the JWT for role).
// No mock branch: auth is inherently a real, live-mode flow.

export interface AuthResult {
  token: string
  user: User
}

export async function register(params: {
  email: string
  password: string
  displayName?: string
}): Promise<AuthResult> {
  const { data } = await api.post<AuthResult>('/auth/register', params)
  return data
}

export async function login(params: { email: string; password: string }): Promise<AuthResult> {
  const { data } = await api.post<AuthResult>('/auth/login', params)
  return data
}

export async function loginWithGoogle(params: { idToken: string }): Promise<AuthResult> {
  const { data } = await api.post<AuthResult>('/auth/google', params)
  return data
}
