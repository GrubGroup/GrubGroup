import { Chip } from '@/components/ui'
import { CUISINE_GROUPS } from '@/constants/dietary'

// Region-grouped cuisine selector: a small region header above a wrapped Chip
// row per group. Shared by the onboarding cuisine steps and the profile edit
// page so the grouped layout is identical everywhere cuisines are chosen.
export interface CuisineGroupPickerProps {
  selected: string[]
  onToggle: (value: string) => void
}

export function CuisineGroupPicker({ selected, onToggle }: CuisineGroupPickerProps) {
  return (
    <div className="flex flex-col gap-4">
      {CUISINE_GROUPS.map((group) => (
        <div key={group.region} className="flex flex-col gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">
            {group.region}
          </span>
          <div className="flex flex-wrap gap-2">
            {group.options.map((opt) => (
              <Chip
                key={opt.value}
                label={opt.label}
                selected={selected.includes(opt.value)}
                onToggle={() => onToggle(opt.value)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
