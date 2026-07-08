import { cn } from '@/utils/cn'

export interface SegmentedProgressProps {
  value: number
  total: number
  tone?: 'dark' | 'primary'
}

// Segmented progress indicator (one bar per member) matching the wireframe.
export function SegmentedProgress({ value, total, tone = 'dark' }: SegmentedProgressProps) {
  const fill = tone === 'primary' ? 'bg-primary' : 'bg-text'
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className={cn('h-1.5 flex-1 rounded-pill', i < value ? fill : 'bg-text/10')}
        />
      ))}
    </div>
  )
}
