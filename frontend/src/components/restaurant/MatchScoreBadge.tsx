import { motion, useReducedMotion } from 'framer-motion'

export interface MatchScoreBadgeProps {
  score?: number | null // 0..1
}

// Large percentage match display (e.g. "94%"). Uses primary brand color. Pops
// (spring scale) whenever the score changes — `key={pct}` remounts the span so a
// new match value lands with a satisfying beat. Reduced motion renders it static.
export function MatchScoreBadge({ score }: MatchScoreBadgeProps) {
  const reduce = useReducedMotion()
  if (score == null) return null
  const pct = Math.round(score * 100)
  return (
    <motion.span
      key={pct}
      initial={{ scale: reduce ? 1 : 0.6, opacity: reduce ? 1 : 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={reduce ? { duration: 0.15 } : { type: 'spring', stiffness: 460, damping: 18 }}
      className="inline-block font-display text-2xl font-bold text-primary"
    >
      {pct}
      <span className="text-base">%</span>
    </motion.span>
  )
}
