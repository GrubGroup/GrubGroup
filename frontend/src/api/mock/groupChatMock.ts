// Mock group-chat messages for the "Group Food Planning App" screen.
// userId 1 = Dev (the current user; own messages render right-aligned/dark).
export interface GroupMsg {
  id: string
  userId: number
  text: string
  time: string
}

export const MOCK_GROUP_MESSAGES: GroupMsg[] = [
  { id: 'g1', userId: 4, text: "Anyone free for lunch today? I'm starving 😭", time: '11:42 AM' },
  { id: 'g2', userId: 6, text: 'Yes! What are we thinking?', time: '11:43 AM' },
  { id: 'g3', userId: 1, text: "I'm in — heads up, still the tree nut thing for me", time: '11:45 AM' },
]

// Messages shown AFTER the session card in the chat.
export const MOCK_GROUP_MESSAGES_AFTER: GroupMsg[] = [
  { id: 'g4', userId: 3, text: "Just joined! Can't wait", time: '11:47 AM' },
]

// The system line that introduces the session card.
export const SESSION_STARTED_BY = 2 // Sophie
