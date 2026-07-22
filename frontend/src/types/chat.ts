// Chat + extracted-preference shapes for the agent session. The AI/message
// contracts are not yet implemented server-side (schemas are stubs), so these
// are frontend-shaped and fed by mock scripts today; socket-fed later.

export type ChatRole = 'agent' | 'user' | 'system'

export interface ChatMessage {
  id: string
  role: ChatRole
  text: string
  at: string // ISO timestamp
}
