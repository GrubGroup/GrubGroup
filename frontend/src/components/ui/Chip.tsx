import { cn } from '@/utils/cn'

export interface ChipProps {
  label: string
  selected?: boolean
  onToggle?: () => void
  disabled?: boolean
  className?: string
}

// Interactive, selectable pill — the atom the Profile page leans on for
// multi-select dietary restrictions and cuisine preferences.
export function Chip({ label, selected = false, onToggle, disabled = false, className }: ChipProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={onToggle}
      className={cn(
        'inline-flex items-center rounded-pill border px-3.5 py-1.5 text-sm font-medium',
        'transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
        'disabled:cursor-not-allowed disabled:opacity-50',
        selected
          ? 'border-surface-inverse bg-surface-inverse text-white'
          : 'border-border bg-surface-sunken text-text-muted hover:border-border-strong',
        className,
      )}
    >
      {label}
    </button>
  )
}
