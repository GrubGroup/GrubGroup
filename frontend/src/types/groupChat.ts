// Live group-chat message — the shape broadcast by the gateway over Socket.IO.
// Frontend-shaped (not mirroring Prisma `GroupMessage`) since there's no DB in
// scope yet; persistence is a documented follow-up.

export interface GroupMessage {
  id: string
  groupId: number
  userId: number | null // DEV: unverified handshake identity for now
  name?: string | null
  text: string
  at: string // ISO timestamp
  // 'system' renders as a centered divider (e.g. "Sofia has left the group").
  // Absent/'text' is a normal chat bubble.
  type?: 'text' | 'system'
}
