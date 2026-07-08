export interface MatchScoreBadgeProps {
  score?: number | null // 0..1
}

// Large percentage match display (e.g. "94%"). Uses primary brand color.
export function MatchScoreBadge({ score }: MatchScoreBadgeProps) {
  if (score == null) return null
  const pct = Math.round(score * 100)
  return (
    <span className="font-display text-2xl font-bold text-primary">
      {pct}
      <span className="text-base">%</span>
    </span>
  )
}
