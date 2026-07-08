import { Badge } from '@/components/ui'
import { useProfileStore } from '@/stores/profileStore'

// Preset budget bands (per person, per meal) mirroring the onboarding wireframe.
const BANDS: { label: string; min: number; max: number }[] = [
  { label: 'Under $15', min: 0, max: 15 },
  { label: '$15–25', min: 15, max: 25 },
  { label: '$25–40', min: 25, max: 40 },
  { label: '$40+', min: 40, max: 200 },
]

export function BudgetRangeField() {
  const budgetMin = useProfileStore((s) => s.profile?.budget_min ?? 0)
  const budgetMax = useProfileStore((s) => s.profile?.budget_max ?? 0)
  const setBudget = useProfileStore((s) => s.setBudget)

  return (
    <fieldset className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div>
          <legend className="font-display text-lg font-semibold text-text">
            What's your usual budget?
          </legend>
          <p className="text-sm text-text-muted">
            Per person, per meal. You can always adjust for special occasions.
          </p>
        </div>
        <Badge tone="primary">
          ${budgetMin}–${budgetMax}
        </Badge>
      </div>
      <div className="flex flex-col gap-2">
        {BANDS.map((band) => {
          const selected = band.min === budgetMin && band.max === budgetMax
          return (
            <button
              key={band.label}
              type="button"
              aria-pressed={selected}
              onClick={() => setBudget(band.min, band.max)}
              className={
                'flex h-12 items-center justify-between rounded-input border px-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring ' +
                (selected
                  ? 'border-primary bg-primary text-on-primary'
                  : 'border-border bg-surface-sunken text-text hover:border-border-strong')
              }
            >
              <span className="font-medium">{band.label}</span>
              {selected && <span aria-hidden="true">✓</span>}
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}
