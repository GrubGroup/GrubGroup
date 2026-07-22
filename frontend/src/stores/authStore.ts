import { create } from 'zustand'
import type { Role, User } from '@/types'

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

interface AuthState {
  user: User | null
  role: Role | null
  isGuest: boolean
  // True once the interactive sign-in/up form has successfully handled auth this
  // session. App uses it to stand down its own post-auth forwarding + splash: the
  // form routes itself (and a brand-new account SLIDES from sign-up into
  // onboarding inside AuthFlowShell), so App must not unmount the shell mid-slide.
  // App's auto-forward is only for the OAuth-return / reload case, where the form
  // never runs and this stays false.
  entryFlowActive: boolean
  setEntryFlowActive: (v: boolean) => void
  // Sync the store from Better Auth's session (called by App on session change).
  setSessionUser: (su: SessionUser | null) => void
  // Merge edited identity fields (display_name/username) after a saved update,
  // so the header/sidebar reflect the change without a full session refresh.
  patchUser: (patch: Partial<User>) => void
  loginAsGuest: (name: string) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>((set, get) => ({
  // Starts null; a real Better Auth session is applied at runtime via
  // setSessionUser (from useSession in App).
  user: null,
  role: null,
  isGuest: false,
  entryFlowActive: false,

  setEntryFlowActive: (v) => set({ entryFlowActive: v }),

  setSessionUser: (su) => {
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
    set({ user: null, role: null, isGuest: false, entryFlowActive: false })
  },
}))
