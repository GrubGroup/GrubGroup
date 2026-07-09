import { create } from 'zustand'
import type { Role, User } from '@/types'
import { decodeToken } from '@/lib/jwt'
import { setAuthToken } from '@/lib/axios'
import { MOCK_USER } from '@/api/mock/profile.mock'
import { MOCK_MEMBER_NAMES } from '@/api/mock/session.mock'
import { USE_MOCK } from '@/lib/env'

// DEV ONLY: let two browser windows act as different members via a URL param,
// e.g. localhost:5173?as=2 signs in as Sofia. Works even in live mode so the
// live-chat demo can show distinct senders. Remove once real auth exists.
function userFromUrlParam(): User | null {
  if (typeof window === 'undefined') return null
  const asId = Number(new URLSearchParams(window.location.search).get('as'))
  if (!asId) return null
  const name = MOCK_MEMBER_NAMES[asId] ?? `User ${asId}`
  return { ...MOCK_USER, id: asId, username: name.toLowerCase(), display_name: name }
}

// `?as=` wins (demo override); else mock mode seeds the default user; else null.
const INITIAL_USER = userFromUrlParam() ?? (USE_MOCK ? MOCK_USER : null)

interface AuthState {
  user: User | null
  token: string | null
  role: Role | null
  isGuest: boolean
  login: (token: string, user: User) => void
  loginAsGuest: (name: string) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  // In mock mode (or with a ?as= dev override), start signed in so pages have context.
  user: INITIAL_USER,
  token: null,
  role: INITIAL_USER?.role ?? null,
  isGuest: false,

  login: (token, user) => {
    setAuthToken(token)
    const claims = decodeToken(token)
    set({ token, user, role: claims?.role ?? user.role, isGuest: false })
  },

  loginAsGuest: (name) => {
    // DEV: honor the ?as= override so two windows sign in as different members.
    const asUser = userFromUrlParam()
    if (asUser) {
      set({ isGuest: false, token: null, role: asUser.role, user: asUser })
      return
    }
    set({
      isGuest: true,
      token: null,
      role: 'USER',
      user: {
        id: -1,
        username: name,
        email: '',
        role: 'USER',
        display_name: name,
        avatar_url: null,
        created_at: '',
        updated_at: '',
      },
    })
  },

  logout: () => {
    setAuthToken(null)
    set({ user: null, token: null, role: null, isGuest: false })
  },
}))
