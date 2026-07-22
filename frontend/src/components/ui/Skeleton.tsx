import { cn } from '@/utils/cn'

export interface SkeletonProps {
  className?: string
}

// A single shimmering placeholder block. Compose sizes/shape via className
// (e.g. `h-3 w-24 rounded-pill`). The shimmer sweep is defined in index.css and
// freezes to a static tint under prefers-reduced-motion.
export function Skeleton({ className }: SkeletonProps) {
  return (
    <span
      aria-hidden="true"
      className={cn('block rounded-input bg-surface-sunken animate-shimmer', className)}
    />
  )
}

// A search-result placeholder row: circular avatar + two text bars, matching the
// real result rows in the user/group pickers. Render 2-3 of these while a search
// is in flight.
export function SkeletonRow({ className }: SkeletonProps) {
  return (
    <div className={cn('flex items-center gap-3 px-3 py-2', className)}>
      <Skeleton className="h-8 w-8 shrink-0 rounded-pill" />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <Skeleton className="h-3 w-2/5" />
        <Skeleton className="h-2.5 w-3/5" />
      </div>
    </div>
  )
}
