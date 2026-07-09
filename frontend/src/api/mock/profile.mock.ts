import type { Profile, User } from '@/types'

const now = '2026-07-08T00:00:00.000Z'

export const MOCK_USER: User = {
  id: 1,
  username: 'dev',
  email: 'dev@example.com',
  role: 'USER',
  display_name: 'Dev Patel',
  avatar_url: null,
  created_at: now,
  updated_at: now,
}

export const MOCK_PROFILE: Profile = {
  id: 1,
  user_id: 1,
  dietary_restrictions: ['nut-free'], // Dev's tree-nut allergy → needs nut-free kitchens
  disliked_cuisines: ['ethiopian'],
  preferred_cuisines: ['mexican', 'japanese'],
  budget_min: 15,
  budget_max: 25,
  liked_restaurant_ids: [2, 23], // La Taqueria, Souvla (real seed ids)
  created_at: now,
  updated_at: now,
}
