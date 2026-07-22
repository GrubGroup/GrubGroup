import { useEffect, useState } from 'react'
import { GroupsSidebar } from '@/components/session/GroupsSidebar'
import { RankedRestaurantCard } from '@/components/restaurant/RankedRestaurantCard'
import { RestaurantHeader } from '@/components/restaurant/RestaurantHeader'
import { MenuList } from '@/components/restaurant/MenuList'
import { Button, Spinner } from '@/components/ui'
import {
  useSessionStore,
  selectSession,
  selectActiveSessionId,
  selectRecommendation,
  selectRecommendationLoading,
  selectRecommendationError,
  selectVotes,
  selectIsHost,
} from '@/stores/sessionStore'
import { useRestaurantStore } from '@/stores/restaurantStore'
import { useAuthStore } from '@/stores/authStore'
import { useNavStore } from '@/stores/navStore'
import { USE_MOCK } from '@/lib/env'
import { closeSession } from '@/api/sessionApi'

export function TopPicksPage() {
  const go = useNavStore((s) => s.go)
  const groupId = useNavStore((s) => s.groupId)
  // Session state is keyed by group — read THIS group's slice via selectors.
  const session = useSessionStore(selectSession(groupId))
  const activeSessionId = useSessionStore(selectActiveSessionId(groupId))
  const recommendation = useSessionStore(selectRecommendation(groupId))
  const recommendationLoading = useSessionStore(selectRecommendationLoading(groupId))
  const recommendationError = useSessionStore(selectRecommendationError(groupId))
  const loadRecommendation = useSessionStore((s) => s.loadRecommendation)
  const loadSession = useSessionStore((s) => s.load)
  const votes = useSessionStore(selectVotes(groupId))
  const castVote = useSessionStore((s) => s.castVote)
  const chooseRestaurant = useSessionStore((s) => s.chooseRestaurant)
  const isHost = useSessionStore(selectIsHost(groupId))
  const byId = useRestaurantStore((s) => s.byId)
  const restaurantsLoaded = useRestaurantStore((s) => s.loaded)
  const loadRestaurants = useRestaurantStore((s) => s.load)
  const currentUserId = useAuthStore((s) => s.user?.id ?? 1)

  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [confirming, setConfirming] = useState(false)

  useEffect(() => {
    if (USE_MOCK && !session) void loadSession(groupId, 42, currentUserId)
    if (!restaurantsLoaded) void loadRestaurants()
  }, [session, loadSession, currentUserId, groupId, restaurantsLoaded, loadRestaurants])

  useEffect(() => {
    // Fetch once when we have a session but no rec yet — and NOT while a fetch is
    // in flight or after it errored (else this loops). Retry is user-driven via
    // the error state's button; a live session:picks socket delivery also fills it.
    if (session && !recommendation && !recommendationLoading && !recommendationError) {
      void loadRecommendation(groupId)
    }
  }, [session, recommendation, recommendationLoading, recommendationError, loadRecommendation, groupId])

  const picks = (recommendation?.items ?? [])
    .map((item) => {
      const restaurant = byId[item.restaurant_id]
      return restaurant
        ? { ...item, restaurant, voteCount: (votes[item.restaurant_id] ?? []).length }
        : null
    })
    .filter((p): p is NonNullable<typeof p> => p !== null)
    .sort((a, b) => (b.match_score ?? 0) - (a.match_score ?? 0))
    // The results screen shows the group's Top 5.
    .slice(0, 5)

  // Default the detail panel to the top pick.
  const activeId = selectedId ?? picks[0]?.restaurant_id ?? null
  const active = picks.find((p) => p.restaurant_id === activeId)

  // Distinct results states (replacing a single permanent "Loading picks…"):
  //   loading → a fetch (or restaurant catalog load) is in flight
  //   error   → the read-back failed; offer a retry
  //   else    → a recommendation exists but nothing renders (no match / not loaded)
  const isLoading = recommendationLoading || !restaurantsLoaded || (!recommendation && !recommendationError)
  const isError = recommendationError && picks.length === 0

  const handleConfirm = async () => {
    if (activeId == null || confirming) return
    chooseRestaurant(groupId, activeId)
    const sessionId = activeSessionId ?? session?.id ?? null
    if (!USE_MOCK && sessionId != null) {
      setConfirming(true)
      try {
        await closeSession(sessionId, activeId)
      } catch {
        // Surface nothing fatal — the confirm is idempotent-ish (409 if already
        // closed). Fall through to the completion screen regardless.
      } finally {
        setConfirming(false)
      }
    }
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
            onVote={() => castVote(groupId, pick.restaurant_id, currentUserId)}
            onSelect={() => setSelectedId(pick.restaurant_id)}
            showHours
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
              {isHost ? (
                <>
                  <Button
                    fullWidth
                    variant="primary"
                    isLoading={confirming}
                    onClick={() => void handleConfirm()}
                  >
                    Confirm this restaurant
                  </Button>
                  <p className="mt-2 text-center text-xs text-text-muted">
                    This creates the event and notifies your whole group
                  </p>
                </>
              ) : (
                <p className="text-center text-xs text-text-muted">
                  Vote for your favorite — the host confirms the final pick.
                </p>
              )}
            </div>
          </>
        ) : isLoading ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-text-muted">
            <Spinner size="md" />
            <p className="text-sm">Finding the group's picks…</p>
          </div>
        ) : isError ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
            <p className="text-sm font-medium text-text">Couldn't load results</p>
            <p className="max-w-xs text-xs text-text-muted">
              Something went wrong fetching the group's picks. Give it another try.
            </p>
            <Button variant="primary" size="sm" onClick={() => void loadRecommendation(groupId)}>
              Retry
            </Button>
          </div>
        ) : (
          // Empty: a recommendation came back with nothing that matches the group.
          <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
            <p className="text-sm font-medium text-text">No matching spots found</p>
            <p className="max-w-xs text-xs text-text-muted">
              We couldn't find restaurants that fit everyone's budget and location. Try a
              wider budget or a more central meeting spot next time.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
