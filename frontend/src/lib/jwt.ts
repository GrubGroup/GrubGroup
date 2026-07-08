import { jwtDecode } from 'jwt-decode'
import type { Role } from '@/types'

// The gateway mints JWTs; the frontend only decodes claims for role/routing.
export interface JwtClaims {
  sub: string
  userId: number
  role: Role
  exp?: number
}

export function decodeToken(token: string): JwtClaims | null {
  try {
    return jwtDecode<JwtClaims>(token)
  } catch {
    return null
  }
}
