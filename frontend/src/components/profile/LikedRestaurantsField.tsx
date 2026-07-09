import { RestaurantCardMini } from '@/components/restaurant/RestaurantCardMini'
import { useProfileStore } from '@/stores/profileStore'
import { useRestaurantStore } from '@/stores/restaurantStore'

export function LikedRestaurantsField() {
  const likedIds = useProfileStore((s) => s.profile?.liked_restaurant_ids ?? [])
  const toggleLiked = useProfileStore((s) => s.toggleLikedRestaurant)
  const byId = useRestaurantStore((s) => s.byId)

  const liked = likedIds.map((id) => byId[id]).filter(Boolean)

  return (
    <fieldset className="flex flex-col gap-3">
      <div>
        <legend className="font-display text-lg font-semibold text-text">Favorite spots</legend>
        <p className="text-sm text-text-muted">
          Restaurants you love. The AI leans on these when picking for your group.
        </p>
      </div>
      {liked.length === 0 ? (
        <p className="rounded-input border border-dashed border-border bg-surface-sunken px-4 py-6 text-center text-sm text-text-muted">
          No favorites yet.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {liked.map((r) => (
            <RestaurantCardMini key={r.id} restaurant={r} onRemove={() => toggleLiked(r.id)} />
          ))}
        </div>
      )}
    </fieldset>
  )
}
