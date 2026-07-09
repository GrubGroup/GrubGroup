// A group (chat room). Mirrors the useful bits of Prisma `Group` (id, name) plus
// UI-only fields for the sidebar list.

export interface Group {
  id: number
  name: string
  emoji: string
  preview?: string // last-message preview (UI only)
  time?: string // relative time label, e.g. "2m" (UI only)
}
