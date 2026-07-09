import type { Restaurant } from '@/types'
import { Badge, IconButton, Icon } from '@/components/ui'

export interface RestaurantCardMiniProps {
  restaurant: Restaurant
  onRemove?: () => void
}

export function RestaurantCardMini({ restaurant, onRemove }: RestaurantCardMiniProps) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-input border border-border bg-surface-raised px-4 py-3">
      <div className="min-w-0">
        <p className="truncate font-medium text-text">{restaurant.name}</p>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          {restaurant.cuisine_tags[0] && <Badge tone="kraft">{restaurant.cuisine_tags[0]}</Badge>}
          {restaurant.price_avg != null && (
            <span className="text-sm text-text-muted">~${restaurant.price_avg}</span>
          )}
        </div>
      </div>
      {onRemove && (
        <IconButton
          label={`Remove ${restaurant.name}`}
          size="sm"
          icon={<Icon name="x" size={14} />}
          onClick={onRemove}
        />
      )}
    </div>
  )
}
