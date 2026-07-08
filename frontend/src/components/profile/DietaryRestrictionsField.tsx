import { Chip } from '@/components/ui'
import { DIETARY_RESTRICTIONS } from '@/constants/dietary'
import { useProfileStore } from '@/stores/profileStore'

export function DietaryRestrictionsField() {
  const dietary = useProfileStore((s) => s.profile?.dietary_restrictions ?? [])
  const toggleDietary = useProfileStore((s) => s.toggleDietary)

  return (
    <fieldset className="flex flex-col gap-3">
      <div>
        <legend className="font-display text-lg font-semibold text-text">Any dietary needs?</legend>
        <p className="text-sm text-text-muted">
          Set once — the AI remembers for every session. You'll never be asked again.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {DIETARY_RESTRICTIONS.map((opt) => (
          <Chip
            key={opt.value}
            label={opt.label}
            selected={dietary.includes(opt.value)}
            onToggle={() => toggleDietary(opt.value)}
          />
        ))}
      </div>
    </fieldset>
  )
}
