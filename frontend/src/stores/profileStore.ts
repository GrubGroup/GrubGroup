import { create } from 'zustand'
import type { LocationPref, Profile } from '@/types'
import { fetchProfile, saveProfile } from '@/api/profile.api'

interface ProfileState {
  profile: Profile | null
  preferredLocation?: LocationPref // CLIENT-ONLY (see types/profile.ts)
  loading: boolean
  saving: boolean
  load: () => Promise<void>
  toggleDietary: (value: string) => void
  toggleCuisine: (value: string, list: 'preferred' | 'disliked') => void
  setBudget: (min: number, max: number) => void
  toggleLikedRestaurant: (id: number) => void
  setPreferredLocation: (loc: LocationPref | undefined) => void
  save: () => Promise<void>
}

// Remove `value` from an array if present, else add it. Pure.
function toggleIn(arr: string[], value: string): string[] {
  return arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value]
}

export const useProfileStore = create<ProfileState>((set, get) => ({
  profile: null,
  preferredLocation: undefined,
  loading: false,
  saving: false,

  load: async () => {
    set({ loading: true })
    const profile = await fetchProfile()
    set({ profile, loading: false })
  },

  toggleDietary: (value) => {
    const p = get().profile
    if (!p) return
    set({ profile: { ...p, dietary_restrictions: toggleIn(p.dietary_restrictions, value) } })
  },

  toggleCuisine: (value, list) => {
    const p = get().profile
    if (!p) return
    if (list === 'preferred') {
      // A cuisine can't be both preferred and disliked.
      set({
        profile: {
          ...p,
          preferred_cuisines: toggleIn(p.preferred_cuisines, value),
          disliked_cuisines: p.disliked_cuisines.filter((v) => v !== value),
        },
      })
    } else {
      set({
        profile: {
          ...p,
          disliked_cuisines: toggleIn(p.disliked_cuisines, value),
          preferred_cuisines: p.preferred_cuisines.filter((v) => v !== value),
        },
      })
    }
  },

  setBudget: (min, max) => {
    const p = get().profile
    if (!p) return
    set({ profile: { ...p, budget_min: min, budget_max: max } })
  },

  toggleLikedRestaurant: (id) => {
    const p = get().profile
    if (!p) return
    const liked = p.liked_restaurant_ids.includes(id)
      ? p.liked_restaurant_ids.filter((r) => r !== id)
      : [...p.liked_restaurant_ids, id]
    set({ profile: { ...p, liked_restaurant_ids: liked } })
  },

  setPreferredLocation: (loc) => set({ preferredLocation: loc }),

  save: async () => {
    const p = get().profile
    if (!p) return
    set({ saving: true })
    const saved = await saveProfile(p)
    set({ profile: saved, saving: false })
  },
}))
