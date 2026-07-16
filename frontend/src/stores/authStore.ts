import { create } from 'zustand'
import type { Role, User } from '@/types'
import { MOCK_USER } from '@/api/mock/profile.mock'
import { MOCK_MEMBER_NAMES } from '@/api/mock/session.mock'
import { USE_MOCK } from '@/lib/env'

// DEV ONLY: let two browser windows act as different members via a URL param,
// e.g. localhost:5173?as=2 signs in as Sofia. Works even in live mode so the
// live-chat demo can show distinct senders. Remove once real auth is enforced.
function userFromUrlParam(): User | null {
  if (typeof window === 'undefined') return null
  const asId = Number(new URLSearchParams(window.location.search).get('as'))
  if (!asId) return null
  const name = MOCK_MEMBER_NAMES[asId] ?? `User ${asId}`
  return { ...MOCK_USER, id: asId, username: name.toLowerCase(), display_name: name }
}

// Better Auth's session user (string id + camelCase). Shape the fields we read.
export interface SessionUser {
  id: string | number
  email: string
  username?: string | null
  displayUsername?: string | null
  name?: string | null
  image?: string | null
  role?: Role | null
}

// Map a Better Auth session user onto the app's domain User (numeric id,
// snake_case). IDs come back as strings even with serial IDs — coerce to number.
function toDomainUser(su: SessionUser): User {
  return {
    id: Number(su.id),
    username: su.username ?? su.email,
    email: su.email,
    role: su.role ?? 'USER',
    display_name: su.name ?? null,
    avatar_url: su.image ?? null,
    created_at: '',
    updated_at: '',
  }
}

// `?as=` wins (demo override); else mock mode seeds the default user; else null
// (a real session is applied at runtime via setSessionUser from useSession).
const INITIAL_USER = userFromUrlParam() ?? (USE_MOCK ? MOCK_USER : null)

interface AuthState {
  user: User | null
  role: Role | null
  isGuest: boolean
  // Sync the store from Better Auth's session (called by App on session change).
  setSessionUser: (su: SessionUser | null) => void
  // Merge edited identity fields (display_name/username) after a saved update,
  // so the header/sidebar reflect the change without a full session refresh.
  patchUser: (patch: Partial<User>) => void
  loginAsGuest: (name: string) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: INITIAL_USER,
  role: INITIAL_USER?.role ?? null,
  isGuest: false,

  setSessionUser: (su) => {
    // Never override the dev ?as= impersonation with the real session.
    if (userFromUrlParam()) return
    if (!su) {
      set({ user: null, role: null, isGuest: false })
      return
    }
    const user = toDomainUser(su)
    set({ user, role: user.role, isGuest: false })
  },

  patchUser: (patch) => {
    const current = get().user
    if (!current) return
    set({ user: { ...current, ...patch } })
  },

  loginAsGuest: (name) => {
    // DEV: honor the ?as= override so two windows sign in as different members.
    const asUser = userFromUrlParam()
    if (asUser) {
      set({ isGuest: false, role: asUser.role, user: asUser })
      return
    }
    set({
      isGuest: true,
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
    set({ user: null, role: null, isGuest: false })
  },
}))
