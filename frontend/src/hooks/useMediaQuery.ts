import { useCallback, useSyncExternalStore } from 'react'

// Subscribes to a CSS media query and returns whether it currently matches.
//
// The server/first-paint snapshot is `false` so callers that use it to opt INTO
// an enhancement — e.g. the landing page's pinned scroll reveal, which only runs
// on `(min-width: 640px)` — render their safe fallback first and upgrade once the
// client snapshot resolves. That avoids a layout pop and keeps the initial paint
// = the fallback branch. Uses `useSyncExternalStore` so there's no setState-in-
// effect and the value stays in sync via the matchMedia `change` event.
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const mql = window.matchMedia(query)
      mql.addEventListener('change', onChange)
      return () => mql.removeEventListener('change', onChange)
    },
    [query],
  )
  const getSnapshot = useCallback(() => window.matchMedia(query).matches, [query])
  const getServerSnapshot = () => false

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
