import type { RankedPick } from '@/types'
import { Badge, Button, Icon } from '@/components/ui'
import { cn } from '@/utils/cn'

export interface RankedRestaurantCardProps {
  rank: number
  pick: RankedPick
  selected: boolean
  hasVoted: boolean
  onVote: () => void
  onSelect: () => void
}

export function RankedRestaurantCard({
  rank,
  pick,
  selected,
  hasVoted,
  onVote,
  onSelect,
}: RankedRestaurantCardProps) {
  const { restaurant } = pick
  const pct = pick.match_score != null ? Math.round(pick.match_score * 100) : null
  const priceDollars = restaurant.price_avg != null ? '$'.repeat(Math.min(4, Math.ceil(restaurant.price_avg / 15))) : ''

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onSelect()
      }}
      className={cn(
        'flex w-full cursor-pointer flex-col gap-2 border-b border-border px-4 py-4 text-left transition-colors',
        selected ? 'border-l-2 border-l-primary bg-surface-raised' : 'hover:bg-surface-raised/50',
      )}
    >
      <div className="flex items-start gap-3">
        <span className="pt-0.5 text-sm font-semibold text-text-muted">{rank}</span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="font-display text-[15px] font-semibold text-text">{restaurant.name}</span>
            {pct != null && (
              <span className="font-display text-lg font-bold text-primary">
                {pct}
                <span className="text-xs">%</span>
              </span>
            )}
          </div>
          <div className="mt-0.5 flex items-center gap-2 text-xs text-text-muted">
            <span className="flex items-center gap-1">
              <Icon name="map-pin" size={11} />
              {restaurant.address?.split(',')[0]?.slice(0, 14) ?? 'nearby'}
            </span>
            <span>{priceDollars}</span>
          </div>
        </div>
      </div>

      {/* vote progress bar */}
      <div className="ml-6 h-1 overflow-hidden rounded-pill bg-surface-sunken">
        <div className="h-full rounded-pill bg-primary/40" style={{ width: `${pct ?? 0}%` }} />
      </div>

      <div className="ml-6 flex flex-wrap gap-1.5">
        {restaurant.dietary_tags.slice(0, 3).map((t) => (
          <Badge key={t} tone="success">
            {t}
          </Badge>
        ))}
      </div>

      {pick.justification && (
        <p className="ml-6 line-clamp-2 text-xs text-text-muted">{pick.justification}</p>
      )}

      <div className="ml-6 flex items-center justify-between">
        <span className="text-xs text-text-muted">
          {pick.voteCount} {pick.voteCount === 1 ? 'vote' : 'votes'}
        </span>
        <Button
          variant={hasVoted ? 'primary' : 'ghost'}
          size="sm"
          leftIcon={hasVoted ? <Icon name="check" size={13} /> : undefined}
          onClick={(e) => {
            e.stopPropagation()
            onVote()
          }}
        >
          {hasVoted ? 'Voted' : 'Vote'}
        </Button>
      </div>
    </div>
  )
}
