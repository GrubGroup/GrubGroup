import { useState } from 'react'

// Location input hook. `use-places-autocomplete` requires the Google Maps
// Places script (an API key) to be loaded. Until that's wired, we degrade to a
// free-text location field so the UI works with no key. When the script is
// present (window.google.maps.places), swap the internals to the library's
// usePlacesAutocomplete without changing the component API below.
export interface PlacesInputResult {
  value: string
  setValue: (v: string) => void
  suggestions: string[]
  ready: boolean
}

export function usePlacesInput(initial = ''): PlacesInputResult {
  const [value, setValue] = useState(initial)
  // Google not loaded → no suggestions, plain text entry.
  const ready = typeof window !== 'undefined' && Boolean((window as { google?: unknown }).google)
  return { value, setValue, suggestions: [], ready }
}
