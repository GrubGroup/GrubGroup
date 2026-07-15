import { create } from 'zustand'
import type { LocationPref, Profile } from '@/types'
import { fetchProfile, saveProfile } from '@/api/profile.api'

interface ProfileState {
  profile: Profile | null
  preferredLocation?: LocationPref // in-flight picker value (see types/profile.ts)
  loading: boolean
  saving: boolean
  load: () => Promise<void>
  toggleDietary: (value: string) => void
  toggleCuisine: (value: string, list: 'preferred' | 'disliked') => void
  // Set a cuisine's explicit state (tri-state picker): 'like' → preferred,
  // 'avoid' → disliked, 'neutral' → removed from both. Always mutually exclusive.
  setCuisineState: (value: string, state: 'neutral' | 'like' | 'avoid') => void
  setBudget: (min: number, max: number) => void
  setLocation: (address: string, coords?: { lat: number; lon: number }) => void
  // Preferred search radius (miles) around the default address.
  setRadius: (miles: number) => void
  toggleLikedRestaurant: (id: number) => void
  setPreferredLocation: (loc: LocationPref | undefined) => void
  save: () => Promise<void>
}

// Remove `value` from an array if present, else add it. Pure.
function toggleIn(arr: string[], value: string): string[] {
  return arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value]
}

// A blank profile for a brand-new user (no row yet). Mutators need a base
// object to spread onto; the gateway upserts it on the first save().
function emptyProfile(): Profile {
  const now = new Date().toISOString()
  return {
    id: 0,
    user_id: 0,
    dietary_restrictions: [],
    disliked_cuisines: [],
    preferred_cuisines: [],
    budget_min: 15,
    budget_max: 25,
    default_address: null,
    default_lat: null,
    default_lon: null,
    default_radius: null,
    liked_restaurant_ids: [],
    created_at: now,
    updated_at: now,
  }
}

export const useProfileStore = create<ProfileState>((set, get) => ({
  profile: null,
  preferredLocation: undefined,
  loading: false,
  saving: false,

  load: async () => {
    set({ loading: true })
    const profile = await fetchProfile()
    // New user (gateway 404 → null): seed a blank profile so onboarding's
    // mutators have a base to edit; save() upserts it. Also seed the picker
    // value from a persisted default_address so the location field prefills.
    const seeded = profile ?? emptyProfile()
    set({
      profile: seeded,
      preferredLocation: seeded.default_address
        ? { mode: 'named', label: seeded.default_address }
        : get().preferredLocation,
      loading: false,
    })
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

  setCuisineState: (value, state) => {
    const p = get().profile
    if (!p) return
    // Drop from both lists, then add to the one the target state names — keeps
    // preferred/disliked mutually exclusive by construction.
    const preferred = p.preferred_cuisines.filter((v) => v !== value)
    const disliked = p.disliked_cuisines.filter((v) => v !== value)
    if (state === 'like') preferred.push(value)
    else if (state === 'avoid') disliked.push(value)
    set({ profile: { ...p, preferred_cuisines: preferred, disliked_cuisines: disliked } })
  },

  setBudget: (min, max) => {
    const p = get().profile
    if (!p) return
    set({ profile: { ...p, budget_min: min, budget_max: max } })
  },

  // Persist the default dining address onto the profile. Address is required;
  // coords are optional (cleared when omitted, since a plain text edit has none).
  setLocation: (address, coords) => {
    const p = get().profile
    if (!p) return
    set({
      profile: {
        ...p,
        default_address: address || null,
        default_lat: coords?.lat ?? null,
        default_lon: coords?.lon ?? null,
      },
      preferredLocation: address ? { mode: 'named', label: address } : undefined,
    })
  },

  setRadius: (miles) => {
    const p = get().profile
    if (!p) return
    set({ profile: { ...p, default_radius: miles } })
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
    // Fold any in-flight picker label onto the profile before persisting, so the
    // LocationField path (which only sets preferredLocation) still saves the
    // default_address. An explicit default_address on the profile wins.
    const loc = get().preferredLocation
    const toSave: Profile =
      loc?.label && !p.default_address
        ? { ...p, default_address: loc.label, default_lat: loc.lat ?? null, default_lon: loc.lon ?? null }
        : p
    const saved = await saveProfile(toSave)
    set({ profile: saved, saving: false })
  },
}))
