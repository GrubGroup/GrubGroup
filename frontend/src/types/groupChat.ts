// Live group-chat message — the shape broadcast by the gateway over Socket.IO
// (and replayed from persisted history on join). Frontend-shaped, aligned to the
// gateway's `toWireMessage` output (sockets/sessionHandlers.js).
import type { SessionBlock } from './recommendation'

export interface GroupMessage {
  id: string
  groupId: number
  userId: number | null // DEV: unverified handshake identity for now
  name?: string | null
  text: string
  at: string // ISO timestamp
  // 'system' renders as a centered divider (e.g. "Sofia has left the group").
  // 'session_block' renders the inline top-5 picks card (payload in `block`);
  // its `text` is empty so the raw JSON is never shown. Absent/'text' is a
  // normal chat bubble.
  type?: 'text' | 'system' | 'session_block'
  // Present only when type === 'session_block': the parsed picks payload the
  // gateway stored as JSON (or broadcast live via session:picks).
  block?: SessionBlock | null
}
