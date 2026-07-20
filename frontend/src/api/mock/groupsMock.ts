import type { Group } from '@/types'

// The user's group chats shown in the left sidebar. Ids are real so each is its
// own isolated chat room. Group 7 (Work Lunch Crew) matches the seeded session
// (MOCK_SESSION.group_id: 7). The preview/time fields are static sidebar labels.
export const MOCK_GROUPS: Group[] = [
  { id: 7, name: 'Work Lunch Crew', emoji: '🍱', preview: 'Tomás: Just joined the session 🎉', time: '2m' },
  { id: 8, name: 'Friday Friends', emoji: '🍕', preview: 'Dev: This Friday?', time: '1h' },
  { id: 9, name: 'Dev + Maya', emoji: '☕', preview: 'Maya: See you there!', time: '3h' },
  { id: 10, name: 'Date Night', emoji: '🍷', preview: 'Priya: Saturday works 😊', time: '1d' },
]
