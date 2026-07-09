// Canonical option lists for profile/session preference selection.
//
// Dietary vocabulary is the CONTROLLED LIST from backend/prisma/seed.mjs — these
// exact hyphenated tokens are what restaurants are tagged with (dietary_tags),
// so a profile restriction matches a restaurant that accommodates it.
// Do NOT invent values outside this list.

export interface Option {
  value: string
  label: string
}

export const DIETARY_RESTRICTIONS: Option[] = [
  { value: 'vegetarian', label: 'Vegetarian' },
  { value: 'vegan', label: 'Vegan' },
  { value: 'gluten-free', label: 'Gluten-free' },
  { value: 'nut-free', label: 'Nut-free' },
  { value: 'dairy-free', label: 'Dairy-free' },
  { value: 'shellfish-free', label: 'Shellfish-free' },
  { value: 'halal', label: 'Halal' },
  { value: 'kosher', label: 'Kosher' },
]

// Broad "parent" cuisines that appear as the first cuisine_tag in the seed data.
export const CUISINES: Option[] = [
  { value: 'mexican', label: 'Mexican' },
  { value: 'japanese', label: 'Japanese' },
  { value: 'chinese', label: 'Chinese' },
  { value: 'vietnamese', label: 'Vietnamese' },
  { value: 'thai', label: 'Thai' },
  { value: 'indian', label: 'Indian' },
  { value: 'italian', label: 'Italian' },
  { value: 'greek', label: 'Greek' },
  { value: 'american', label: 'American' },
  { value: 'korean', label: 'Korean' },
  { value: 'middle-eastern', label: 'Middle Eastern' },
  { value: 'mediterranean', label: 'Mediterranean' },
  { value: 'latin-american', label: 'Latin American' },
  { value: 'ethiopian', label: 'Ethiopian' },
]

export function labelFor(options: Option[], value: string): string {
  return options.find((o) => o.value === value)?.label ?? value
}
