import type { ChatMessage, NotedPref } from '@/types'

// Scripted opening of the agent conversation. Later fed by socket events.
export const MOCK_CHAT_OPENING: ChatMessage[] = [
  {
    id: 'm1',
    role: 'agent',
    text: "Hey Dev! I'm your food agent for this session. What sounds good to you today?",
    at: '2026-07-08T11:42:00.000Z',
  },
  {
    id: 'm2',
    role: 'user',
    text: 'Something filling, under $20 a head. And no tree nuts, as always.',
    at: '2026-07-08T11:43:00.000Z',
  },
  {
    id: 'm3',
    role: 'agent',
    text: 'Tree nut allergy noted, and ~$20/pp budget is locked in. Are you near the office on Market Street today?',
    at: '2026-07-08T11:45:00.000Z',
  },
]

// Canned agent replies, cycled as the user sends messages (mock only).
export const MOCK_AGENT_REPLIES: string[] = [
  "Got it — I'm syncing that with the group now.",
  'Noted. Anything on the vibe — quick bite or sit-down?',
  "Thanks! I think I have enough. I'll factor everything in.",
]

export const MOCK_NOTED_PREFS: NotedPref[] = [
  { id: 'n1', label: 'No tree nuts', confirmed: true },
  { id: 'n2', label: '~$20pp budget', confirmed: true },
  { id: 'n3', label: 'Near Market St', confirmed: false },
]
