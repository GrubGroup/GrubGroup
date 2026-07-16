// Modeled on Prisma `User` + `Role` enum (backend/prisma/schema.prisma — sole source of truth).
// Dates are ISO strings over the wire.

export type Role = 'USER' | 'OWNER' | 'ADMIN'

export interface User {
  id: number
  username: string
  email: string
  role: Role
  display_name?: string | null
  avatar_url?: string | null
  created_at: string
  updated_at: string
}

// Lightweight user shape returned by GET /api/users/search — just what the
// group member-picker needs to render a result row / selected chip.
export type UserSearchResult = Pick<User, 'id' | 'username' | 'display_name' | 'avatar_url'>
