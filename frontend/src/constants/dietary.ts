// Canonical option lists for profile/session preference selection.
//
// Dietary vocabulary is the CONTROLLED LIST that pairs with restaurant
// `dietary_tags` — these exact hyphenated tokens are how a profile restriction
// matches a restaurant that accommodates it. Do NOT invent values outside this
// list. NOTE: `egg-free`, `soy-free`, `sesame-free` were added ahead of the
// restaurant retag, so they won't match any restaurant until the seed is
// retagged (matching is a superset filter — see the ai_service retriever).
// Cuisines are a soft preference weight, so unmatched cuisine tokens are safe.

export interface Option {
  value: string
  label: string
}

// Diets first (lifestyle/religious), then allergen "free-from" presets. `nut-free`
// intentionally combines peanut + tree nut — restaurants advertise "nut-free",
// not the two separately. Tokens are the controlled hyphenated vocabulary.
export const DIETARY_RESTRICTIONS: Option[] = [
  { value: 'vegetarian', label: 'Vegetarian' },
  { value: 'vegan', label: 'Vegan' },
  { value: 'pescetarian', label: 'Pescetarian' },
  { value: 'halal', label: 'Halal' },
  { value: 'kosher', label: 'Kosher' },
  { value: 'gluten-free', label: 'Gluten-free' },
  { value: 'dairy-free', label: 'Dairy-free' },
  { value: 'nut-free', label: 'Nut-free' },
  { value: 'egg-free', label: 'Egg-free' },
  { value: 'shellfish-free', label: 'Shellfish-free' },
  { value: 'soy-free', label: 'Soy-free' },
  { value: 'sesame-free', label: 'Sesame-free' },
]

export interface CuisineGroup {
  region: string
  options: Option[]
}

// Cuisines grouped by region for a grouped picker (region labels are UI-only —
// the token is what matches restaurant `cuisine_tags`). Some tokens have no seed
// restaurant yet (nepalese, british, persian, lebanese, african) — kept for
// future coverage; cuisines are a soft preference weight, so unmatched tokens
// are harmless no-ops (unlike allergens, which hard-filter).
export const CUISINE_GROUPS: CuisineGroup[] = [
  {
    region: 'Americas',
    options: [
      { value: 'american', label: 'American' },
      { value: 'mexican', label: 'Mexican' },
      { value: 'latin-american', label: 'Latin American' },
      { value: 'caribbean', label: 'Caribbean' },
      { value: 'cajun', label: 'Cajun' },
      { value: 'peruvian', label: 'Peruvian' },
    ],
  },
  {
    region: 'East & Southeast Asian',
    options: [
      { value: 'chinese', label: 'Chinese' },
      { value: 'japanese', label: 'Japanese' },
      { value: 'thai', label: 'Thai' },
      { value: 'vietnamese', label: 'Vietnamese' },
      { value: 'korean', label: 'Korean' },
      { value: 'taiwanese', label: 'Taiwanese' },
      { value: 'filipino', label: 'Filipino' },
      { value: 'cantonese', label: 'Cantonese' },
      { value: 'indonesian', label: 'Indonesian' },
      { value: 'burmese', label: 'Burmese' },
    ],
  },
  {
    region: 'South Asian',
    options: [
      { value: 'indian', label: 'Indian' },
      { value: 'pakistani', label: 'Pakistani' },
      { value: 'nepalese', label: 'Nepalese' },
    ],
  },
  {
    region: 'European',
    options: [
      { value: 'italian', label: 'Italian' },
      { value: 'greek', label: 'Greek' },
      { value: 'french', label: 'French' },
      { value: 'spanish', label: 'Spanish' },
      { value: 'mediterranean', label: 'Mediterranean' },
      { value: 'british', label: 'British / Irish' },
      { value: 'georgian', label: 'Georgian' },
    ],
  },
  {
    region: 'Middle Eastern & African',
    options: [
      { value: 'middle-eastern', label: 'Middle Eastern' },
      { value: 'lebanese', label: 'Lebanese' },
      { value: 'turkish', label: 'Turkish' },
      { value: 'persian', label: 'Persian' },
      { value: 'ethiopian', label: 'Ethiopian' },
      { value: 'african', label: 'African' },
      { value: 'moroccan', label: 'Moroccan' },
    ],
  },
]

// Flat union of every grouped cuisine — kept so existing consumers (labelFor,
// the preferred/disliked pickers, ProfilePage display) work unchanged.
export const CUISINES: Option[] = CUISINE_GROUPS.flatMap((g) => g.options)

// Restaurant STYLE (the kind of place, not the cuisine) — mirrors the backend
// QA sub-agent's master style taxonomy (ai_service `app/ai/taxonomy.py`
// RESTAURANT_STYLES). Values are the same underscore tags the agent records
// into a session's `preferred_cuisines` (there is no separate style column), so
// they weight restaurant `cuisine_tags` exactly like a cuisine does — a soft
// preference, not a hard filter. This is a controlled constant only; no picker
// UI is wired to it yet. Keep it in sync with the backend taxonomy keys.
export const RESTAURANT_STYLES: Option[] = [
  { value: 'barbecue', label: 'Barbecue' },
  { value: 'fast_food', label: 'Fast Food' },
  { value: 'seafood', label: 'Seafood' },
  { value: 'fine_dining', label: 'Fine Dining' },
  { value: 'bakery', label: 'Bakery' },
  { value: 'cafe', label: 'Café' },
  { value: 'buffet', label: 'Buffet' },
  { value: 'food_truck', label: 'Food Truck' },
  { value: 'steakhouse', label: 'Steakhouse' },
  { value: 'vegetarian_vegan', label: 'Vegetarian / Vegan' },
  { value: 'dessert', label: 'Dessert' },
  { value: 'brunch', label: 'Brunch' },
  { value: 'pizza', label: 'Pizza' },
  { value: 'sandwich_deli', label: 'Sandwich / Deli' },
  { value: 'pub_bar', label: 'Pub / Bar' },
]

export function labelFor(options: Option[], value: string): string {
  return options.find((o) => o.value === value)?.label ?? value
}

// Which controlled dietary values are allergen "free-from" presets (safety-
// critical) vs. lifestyle/religious diets. Used to split the Dietary Needs UI
// into two color groups (allergy = purple, diet = blue) consistently across the
// onboarding step and the profile pages.
export const ALLERGEN_VALUES = new Set([
  'gluten-free',
  'dairy-free',
  'nut-free',
  'egg-free',
  'shellfish-free',
  'soy-free',
  'sesame-free',
])

export function isAllergen(value: string): boolean {
  return ALLERGEN_VALUES.has(value)
}
