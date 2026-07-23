// Chat + extracted-preference shapes for the agent session. These are
// frontend-shaped; the agent chat is fed live via analyzeTurn / chatStore.

export type ChatRole = 'agent' | 'user' | 'system'

export interface ChatMessage {
  id: string
  role: ChatRole
  text: string
  at: string // ISO timestamp
}
