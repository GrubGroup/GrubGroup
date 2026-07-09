import { create } from 'zustand'
import type { Role, User } from '@/types'
import { decodeToken } from '@/lib/jwt'
import { setAuthToken } from '@/lib/axios'
import { MOCK_USER } from '@/api/mock/profile.mock'
import { MOCK_MEMBER_NAMES } from '@/api/mock/session.mock'
import { USE_MOCK } from '@/lib/env'

const TOKEN_KEY = 'grubgroup.token'
const USER_KEY = 'grubgroup.user'

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

// Live mode: rehydrate a persisted session from localStorage so a page refresh
// doesn't drop the user. The token is re-attached to axios and decoded for role.
function rehydrateFromStorage(): { user: User; token: string; role: Role | null } | null {
  if (typeof window === 'undefined') return null
  const token = localStorage.getItem(TOKEN_KEY)
  const rawUser = localStorage.getItem(USER_KEY)
  if (!token || !rawUser) return null
  const claims = decodeToken(token)
  // Reject tokens we can't decode or that have already expired.
  if (!claims || (claims.exp && claims.exp * 1000 <= Date.now())) {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
    return null
  }
  try {
    const user = JSON.parse(rawUser) as User
    setAuthToken(token)
    return { user, token, role: claims.role ?? user.role }
  } catch {
    return null
  }
}

// `?as=` wins (demo override); else a persisted live session; else mock mode
// seeds the default user; else null.
const REHYDRATED = USE_MOCK ? null : rehydrateFromStorage()
const INITIAL_USER = userFromUrlParam() ?? REHYDRATED?.user ?? (USE_MOCK ? MOCK_USER : null)

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
  // In mock mode (or with a ?as= dev override), start signed in so pages have
  // context; in live mode, start from any persisted session.
  user: INITIAL_USER,
  token: REHYDRATED?.token ?? null,
  role: INITIAL_USER?.role ?? REHYDRATED?.role ?? null,
  isGuest: false,

  login: (token, user) => {
    setAuthToken(token)
    const claims = decodeToken(token)
    if (typeof window !== 'undefined') {
      localStorage.setItem(TOKEN_KEY, token)
      localStorage.setItem(USER_KEY, JSON.stringify(user))
    }
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
    if (typeof window !== 'undefined') {
      localStorage.removeItem(TOKEN_KEY)
      localStorage.removeItem(USER_KEY)
    }
    set({ user: null, token: null, role: null, isGuest: false })
  },
}))
