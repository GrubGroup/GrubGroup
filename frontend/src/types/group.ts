// A group (chat room). Mirrors the useful bits of Prisma `Group` (id, name) plus
// UI-only fields for the sidebar list.

// The most recent message in a group, used for the sidebar preview line.
export interface GroupLastMessage {
  text: string
  name: string | null
  user_id: number
  at: string // ISO timestamp
}

export interface Group {
  id: number
  name: string
  emoji: string
  // Latest message from the DB (null when the group has no messages yet).
  last_message?: GroupLastMessage | null
  preview?: string // last-message preview (UI only; mock fallback)
  time?: string // relative time label, e.g. "2m" (UI only; mock fallback)
}
