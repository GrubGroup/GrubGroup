import { useEffect, useState } from 'react'

export interface Countdown {
  secondsLeft: number
  expired: boolean
}

// Seconds remaining from `startedAt` for `minutes`, computed from wall-clock so it
// stays accurate across tab throttling. A null/invalid `startedAt` means "not
// started" — the full duration.
function computeSecondsLeft(startedAt: string | null, minutes: number): number {
  if (!startedAt) return minutes * 60
  const start = Date.parse(startedAt)
  if (Number.isNaN(start)) return minutes * 60
  const remainingMs = start + minutes * 60 * 1000 - Date.now()
  return Math.max(0, Math.floor(remainingMs / 1000))
}

// Ticking countdown. Recomputes every second from wall-clock (not by
// decrementing). `secondsLeft` clamps at 0; `expired` flips true once it hits 0.
export function useSessionCountdown(startedAt: string | null, minutes: number): Countdown {
  // Keyed by the inputs so a new session/limit re-seeds the initial value without
  // a setState-in-effect (React re-runs the initializer when the key changes).
  const [secondsLeft, setSecondsLeft] = useState<number>(() =>
    computeSecondsLeft(startedAt, minutes),
  )
  const [key, setKey] = useState(`${startedAt}|${minutes}`)
  const currentKey = `${startedAt}|${minutes}`
  if (key !== currentKey) {
    // Inputs changed: reset synchronously during render (the sanctioned pattern
    // for derived-from-props state), not in an effect.
    setKey(currentKey)
    setSecondsLeft(computeSecondsLeft(startedAt, minutes))
  }

  useEffect(() => {
    if (!startedAt) return
    const id = setInterval(() => {
      setSecondsLeft(computeSecondsLeft(startedAt, minutes))
    }, 1000)
    return () => clearInterval(id)
  }, [startedAt, minutes])

  return { secondsLeft, expired: Boolean(startedAt) && secondsLeft <= 0 }
}
