import type { Recommendation, Session, SessionMember } from '@/types'

const now = '2026-07-08T00:00:00.000Z'

export const MOCK_SESSION: Session = {
  id: 42,
  host_user_id: 2,
  group_id: 7,
  time_limit: 15,
  avg_budget: 20,
  created_at: now,
  closed_at: null,
}

// The signed-in mock user is id 1 (Dev). Host is id 2 (Sofia).
export const MOCK_MEMBERS: SessionMember[] = [
  { session_id: 42, user_id: 1, status: false, joined_at: now }, // Dev (you)
  { session_id: 42, user_id: 2, status: true, joined_at: now }, // Sofia (host)
  { session_id: 42, user_id: 3, status: true, joined_at: now }, // Priya
  { session_id: 42, user_id: 4, status: false, joined_at: now }, // Maya
  { session_id: 42, user_id: 5, status: false, joined_at: now }, // Carlos
  { session_id: 42, user_id: 6, status: false, joined_at: now }, // Tomás
]

// Display names for members (User records would supply these server-side).
export const MOCK_MEMBER_NAMES: Record<number, string> = {
  1: 'Dev',
  2: 'Sofia',
  3: 'Priya',
  4: 'Maya',
  5: 'Carlos',
  6: 'Tomás',
}

// Per-member identity colors (from the wireframe). Maps to the --color-member-*
// tokens so avatars stay distinguishable. Value is the Tailwind class suffix.
export const MOCK_MEMBER_COLORS: Record<number, string> = {
  1: 'member-purple',
  2: 'member-terracotta',
  3: 'member-pink',
  4: 'member-green',
  5: 'member-blue',
  6: 'member-amber',
}

// Restaurant ids reference the real seed (2 La Taqueria, 23 Souvla, 16 Dosa, 38 El Sur) —
// all nut-free-friendly, matching Dev's allergy and the group's ~$20pp budget.
export const MOCK_RECOMMENDATION: Recommendation = {
  id: 1,
  session_id: 42,
  created_at: now,
  items: [
    { id: 1, recommendation_id: 1, restaurant_id: 2, match_score: 0.94, justification: 'Nut-free, gluten-free kitchen at ~$15pp. Covers Dev’s allergy and the whole group’s budget with room to spare.' },
    { id: 2, recommendation_id: 1, restaurant_id: 23, match_score: 0.88, justification: 'Halal, gluten-free rotisserie with strong veg options. Covers Maya’s plant-forward preference; a short walk from Market St.' },
    { id: 3, recommendation_id: 1, restaurant_id: 16, match_score: 0.85, justification: 'Vegan and gluten-free South Indian. Great dietary coverage, slightly above budget at ~$35pp.' },
    { id: 4, recommendation_id: 1, restaurant_id: 38, match_score: 0.79, justification: 'Nut-free Argentine empanadas, cheapest option at ~$15pp. Limited variety beyond empanadas.' },
  ],
}
