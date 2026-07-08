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
