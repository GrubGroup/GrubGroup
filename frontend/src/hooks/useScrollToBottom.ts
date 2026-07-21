import { useEffect, useRef } from 'react'
import { useReducedMotion } from 'framer-motion'

// Keeps a scroll container pinned to its newest content. Attach the returned ref
// to a sentinel `<div>` rendered as the last child of the scroll container.
//
// Distinguishes OPENING a chat from RECEIVING a message:
//   • Opening (first mount, a group switch via `resetKey`, or the initial bulk
//     history load that arrives async over the socket — count jumps from 0, or by
//     more than one) → jump to the bottom INSTANTLY, so the view simply opens
//     already scrolled down with no visible travel.
//   • A single message sent/received (count grows by exactly 1) → smooth-scroll so
//     the new bubble glides into view.
//
// `count` is the message count (the primary trigger). `resetKey` (e.g. the group
// id) forces an instant jump when it changes. Smooth scroll is gated on reduced
// motion: the JS `scrollIntoView({behavior})` call is NOT suppressed by the
// `prefers-reduced-motion` CSS backstop in index.css (see lib/motion.ts).
export function useScrollToBottom<T extends HTMLElement = HTMLDivElement>(
  count: number,
  resetKey?: unknown,
) {
  const endRef = useRef<T>(null)
  const reduce = useReducedMotion()
  const prevCountRef = useRef(0)
  const prevKeyRef = useRef(resetKey)

  useEffect(() => {
    const prevCount = prevCountRef.current
    const keyChanged = prevKeyRef.current !== resetKey
    // Incremental append (+1) on an already-populated, same-chat view → smooth.
    // Everything else (open, switch, bulk load) → instant.
    const incremental = !keyChanged && prevCount > 0 && count - prevCount === 1
    const behavior: ScrollBehavior = incremental && !reduce ? 'smooth' : 'auto'

    prevCountRef.current = count
    prevKeyRef.current = resetKey
    endRef.current?.scrollIntoView({ behavior })
  }, [count, resetKey, reduce])

  return endRef
}
