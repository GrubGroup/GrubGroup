import { useEffect, useState } from 'react'
import { GroupsSidebar } from '@/components/session/GroupsSidebar'
import { RankedRestaurantCard } from '@/components/restaurant/RankedRestaurantCard'
import { RestaurantHeader } from '@/components/restaurant/RestaurantHeader'
import { MenuList } from '@/components/restaurant/MenuList'
import { Button } from '@/components/ui'
import { useSessionStore } from '@/stores/sessionStore'
import { useRestaurantStore } from '@/stores/restaurantStore'
import { useAuthStore } from '@/stores/authStore'
import { useNavStore } from '@/stores/navStore'

export function TopPicksPage() {
  const go = useNavStore((s) => s.go)
  const session = useSessionStore((s) => s.session)
  const recommendation = useSessionStore((s) => s.recommendation)
  const loadRecommendation = useSessionStore((s) => s.loadRecommendation)
  const loadSession = useSessionStore((s) => s.load)
  const votes = useSessionStore((s) => s.votes)
  const castVote = useSessionStore((s) => s.castVote)
  const chooseRestaurant = useSessionStore((s) => s.chooseRestaurant)
  const byId = useRestaurantStore((s) => s.byId)
  const restaurantsLoaded = useRestaurantStore((s) => s.loaded)
  const loadRestaurants = useRestaurantStore((s) => s.load)
  const currentUserId = useAuthStore((s) => s.user?.id ?? 1)

  const [selectedId, setSelectedId] = useState<number | null>(null)

  useEffect(() => {
    if (!session) void loadSession(42, currentUserId)
    if (!restaurantsLoaded) void loadRestaurants()
  }, [session, loadSession, currentUserId, restaurantsLoaded, loadRestaurants])

  useEffect(() => {
    if (session && !recommendation) void loadRecommendation()
  }, [session, recommendation, loadRecommendation])

  const picks = (recommendation?.items ?? [])
    .map((item) => {
      const restaurant = byId[item.restaurant_id]
      return restaurant
        ? { ...item, restaurant, voteCount: (votes[item.restaurant_id] ?? []).length }
        : null
    })
    .filter((p): p is NonNullable<typeof p> => p !== null)
    .sort((a, b) => (b.match_score ?? 0) - (a.match_score ?? 0))

  // Default the detail panel to the top pick.
  const activeId = selectedId ?? picks[0]?.restaurant_id ?? null
  const active = picks.find((p) => p.restaurant_id === activeId)

  const handleConfirm = () => {
    if (activeId == null) return
    chooseRestaurant(activeId)
    go('session-complete')
  }

  return (
    <div className="flex h-screen overflow-hidden bg-surface">
      <GroupsSidebar />

      {/* Center: ranked list */}
      <div className="flex w-[420px] shrink-0 flex-col overflow-y-auto border-r border-border bg-surface">
        <div className="px-4 pb-2 pt-4">
          <h1 className="font-display text-lg font-bold text-text">Top picks for your group</h1>
          <p className="text-xs text-text-muted">
            Matched to everyone's preferences · vote for your favorite
          </p>
        </div>
        {picks.map((pick, i) => (
          <RankedRestaurantCard
            key={pick.restaurant_id}
            rank={i + 1}
            pick={pick}
            selected={pick.restaurant_id === activeId}
            hasVoted={(votes[pick.restaurant_id] ?? []).includes(currentUserId)}
            onVote={() => castVote(pick.restaurant_id, currentUserId)}
            onSelect={() => setSelectedId(pick.restaurant_id)}
          />
        ))}
      </div>

      {/* Right: live detail of the selected pick */}
      <div className="flex flex-1 flex-col overflow-y-auto">
        {active ? (
          <>
            <div className="flex flex-col gap-5 p-6">
              <RestaurantHeader
                restaurant={active.restaurant}
                matchScorePct={active.match_score != null ? Math.round(active.match_score * 100) : undefined}
              />
              <MenuList restaurantId={active.restaurant_id} />
              {active.justification && (
                <div className="rounded-card bg-surface-sunken p-4">
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-muted">
                    Why it matched
                  </p>
                  <p className="text-sm text-text-muted">{active.justification}</p>
                </div>
              )}
            </div>
            <div className="mt-auto border-t border-border bg-surface-raised p-4">
              <Button fullWidth variant="primary" onClick={handleConfirm}>
                Confirm this restaurant
              </Button>
              <p className="mt-2 text-center text-xs text-text-muted">
                This notifies your whole group
              </p>
            </div>
          </>
        ) : (
          <p className="p-6 text-text-muted">Loading picks…</p>
        )}
      </div>
    </div>
  )
}
