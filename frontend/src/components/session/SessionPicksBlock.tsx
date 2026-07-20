import { useEffect, useState } from 'react'
import type { RankedPick, Restaurant, SessionBlock } from '@/types'
import { RankedRestaurantCard } from '@/components/restaurant/RankedRestaurantCard'
import { useRestaurantStore } from '@/stores/restaurantStore'
import { useSessionStore } from '@/stores/sessionStore'
import { closeSession } from '@/api/session.api'

export interface SessionPicksBlockProps {
  block: SessionBlock
  currentUserId: number
}

// The inline "top picks for your group" card the gateway delivers into group
// chat (live via session:picks, or replayed from chat:history). Reuses the same
// RankedRestaurantCard as TopPicksPage. Only the HOST sees the per-pick "Confirm
// this restaurant" button; a confirm closes the session -> creates the Event ->
// the gateway broadcasts session:confirmed (Events tab refreshes elsewhere).
export function SessionPicksBlock({ block, currentUserId }: SessionPicksBlockProps) {
  const byId = useRestaurantStore((s) => s.byId)
  const loaded = useRestaurantStore((s) => s.loaded)
  const loadRestaurants = useRestaurantStore((s) => s.load)
  const votes = useSessionStore((s) => s.votes)
  const castVote = useSessionStore((s) => s.castVote)
  const isHost = useSessionStore((s) => s.isHost())
  const chooseRestaurant = useSessionStore((s) => s.chooseRestaurant)

  const [confirmingId, setConfirmingId] = useState<number | null>(null)
  const [confirmedId, setConfirmedId] = useState<number | null>(null)

  useEffect(() => {
    if (!loaded) void loadRestaurants()
  }, [loaded, loadRestaurants])

  // Join each pick's restaurant_id to the loaded catalog; drop unknown ids. The
  // item may carry its own name/hours/is_open (enriched by the gateway) — keep a
  // synthetic Restaurant fallback so a not-yet-loaded catalog still renders a card.
  const picks: RankedPick[] = block.items
    .map((item): RankedPick | null => {
      const restaurant: Restaurant | undefined = byId[item.restaurant_id]
      if (!restaurant && !item.name) return null
      const resolved: Restaurant =
        restaurant ??
        ({
          id: item.restaurant_id,
          name: item.name ?? 'Restaurant',
          cuisine_tags: [],
          dietary_tags: [],
          hours: item.hours ?? null,
          created_at: '',
          updated_at: '',
        } as Restaurant)
      return {
        ...item,
        restaurant: resolved,
        voteCount: (votes[item.restaurant_id] ?? []).length,
      }
    })
    .filter((p): p is RankedPick => p !== null)
    .sort((a, b) => (b.match_score ?? 0) - (a.match_score ?? 0))
    .slice(0, 5)

  const handleConfirm = async (restaurantId: number) => {
    if (confirmingId != null) return
    setConfirmingId(restaurantId)
    try {
      await closeSession(block.session_id, restaurantId)
      chooseRestaurant(restaurantId)
      setConfirmedId(restaurantId)
    } finally {
      setConfirmingId(null)
    }
  }

  if (picks.length === 0) {
    return (
      <div className="rounded-card border border-primary/40 bg-surface-raised p-4 text-sm text-text-muted">
        Top picks are ready — loading details…
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-card border border-primary/40 bg-surface-raised shadow-sm">
      <div className="flex items-center gap-2 border-b border-border bg-surface-panel px-4 py-3">
        <span className="flex h-6 w-6 items-center justify-center rounded-pill bg-primary/15 text-primary">
          🍽
        </span>
        <div>
          <p className="font-display text-sm font-bold text-text">Top picks for your group</p>
          <p className="text-[11px] text-text-muted">
            {isHost ? 'Pick one to confirm the event' : 'Vote for your favorite'}
          </p>
        </div>
      </div>

      <div className="flex flex-col">
        {picks.map((pick, i) => (
          <RankedRestaurantCard
            key={pick.restaurant_id}
            rank={i + 1}
            pick={pick}
            selected={confirmedId === pick.restaurant_id}
            hasVoted={(votes[pick.restaurant_id] ?? []).includes(currentUserId)}
            onVote={() => castVote(pick.restaurant_id, currentUserId)}
            onSelect={() => {}}
            showHours
            showConfirm={isHost && confirmedId == null}
            confirming={confirmingId === pick.restaurant_id}
            onConfirm={() => void handleConfirm(pick.restaurant_id)}
          />
        ))}
      </div>

      {confirmedId != null && (
        <div className="flex items-center gap-1.5 border-t border-border bg-success/5 px-4 py-2.5 text-xs font-medium text-success">
          Confirmed! Your group event has been created.
        </div>
      )}
    </div>
  )
}
