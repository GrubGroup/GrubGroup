import { Chip } from '@/components/ui'
import { CUISINES } from '@/constants/dietary'
import { useProfileStore } from '@/stores/profileStore'

export function CuisinePreferencesField() {
  const preferred = useProfileStore((s) => s.profile?.preferred_cuisines ?? [])
  const disliked = useProfileStore((s) => s.profile?.disliked_cuisines ?? [])
  const toggleCuisine = useProfileStore((s) => s.toggleCuisine)

  return (
    <fieldset className="flex flex-col gap-5">
      <div>
        <legend className="font-display text-lg font-semibold text-text">Cuisine preferences</legend>
        <p className="text-sm text-text-muted">
          Tell us what you love and what to avoid. A cuisine can't be in both lists.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-text">Love</span>
        <div className="flex flex-wrap gap-2">
          {CUISINES.map((opt) => (
            <Chip
              key={opt.value}
              label={opt.label}
              selected={preferred.includes(opt.value)}
              onToggle={() => toggleCuisine(opt.value, 'preferred')}
            />
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-text">Avoid</span>
        <div className="flex flex-wrap gap-2">
          {CUISINES.map((opt) => (
            <Chip
              key={opt.value}
              label={opt.label}
              selected={disliked.includes(opt.value)}
              onToggle={() => toggleCuisine(opt.value, 'disliked')}
            />
          ))}
        </div>
      </div>
    </fieldset>
  )
}
