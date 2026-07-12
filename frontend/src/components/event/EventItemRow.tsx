import type { EventItem } from '@/types'
import { IconButton, Icon } from '@/components/ui'

export interface EventItemRowProps {
  item: EventItem
  onInc: () => void
  onDec: () => void
}

export function EventItemRow({ item, onInc, onDec }: EventItemRowProps) {
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-text">{item.name}</p>
        <p className="text-xs text-text-muted">${item.price} each</p>
      </div>
      <div className="flex items-center gap-2">
        <IconButton label="Decrease" size="sm" icon={<span aria-hidden>–</span>} onClick={onDec} />
        <span className="w-5 text-center text-sm text-text">{item.quantity}</span>
        <IconButton label="Increase" size="sm" icon={<Icon name="plus" size={14} />} onClick={onInc} />
      </div>
    </div>
  )
}
