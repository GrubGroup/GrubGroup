import { create } from 'zustand'
import type { Role, User } from '@/types'
import { decodeToken } from '@/lib/jwt'
import { setAuthToken } from '@/lib/axios'
import { MOCK_USER } from '@/api/mock/profile.mock'
import { USE_MOCK } from '@/lib/env'

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
  // In mock mode, start signed in as the mock user so pages have context.
  user: USE_MOCK ? MOCK_USER : null,
  token: null,
  role: USE_MOCK ? MOCK_USER.role : null,
  isGuest: false,

  login: (token, user) => {
    setAuthToken(token)
    const claims = decodeToken(token)
    set({ token, user, role: claims?.role ?? user.role, isGuest: false })
  },

  loginAsGuest: (name) => {
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
