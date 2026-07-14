// Modeled on Prisma `Session` + `SessionMember`.
// NOTE: Prisma has NO session-status enum. Per-member readiness is
// `SessionMember.status: boolean`. `SessionPhase` below is FRONTEND-ONLY UI
// state derived from members/recommendation — it is never persisted.

export interface Session {
  id: number
  host_user_id: number
  group_id?: number | null
  time_limit: number
  created_at: string
  closed_at?: string | null
}

export interface SessionMember {
  session_id: number
  user_id: number
  status: boolean // true = done sharing preferences
  joined_at: string
}

// FRONTEND-ONLY: drives which screen shows. Not a DB field.
export type SessionPhase =
  | 'joining'
  | 'waiting'
  | 'chatting'
  | 'done'
  | 'picks'
  | 'detail'
  | 'complete'
