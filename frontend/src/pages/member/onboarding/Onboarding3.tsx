import { Button, Input, Icon } from '@/components/ui'
import { OnboardingLayout } from '@/components/layout/OnboardingLayout'
import { DIETARY_RESTRICTIONS, labelFor } from '@/constants/dietary'
import { usePlacesInput } from '@/hooks/usePlacesInput'
import { useProfileStore } from '@/stores/profileStore'
import { useNavStore } from '@/stores/navStore'
import { cn } from '@/utils/cn'

const DISTANCES = ['0.5 mi', '1 mi', '2 mi', '5 mi']

export function Onboarding3() {
  const go = useNavStore((s) => s.go)
  const profile = useProfileStore((s) => s.profile)
  const save = useProfileStore((s) => s.save)
  const setLocation = useProfileStore((s) => s.setLocation)
  // Prefill from any already-set default location, else a sensible placeholder.
  const { value, setValue } = usePlacesInput(profile?.default_location ?? 'San Francisco, CA')

  const dietary = profile?.dietary_restrictions ?? []

  const handleDone = async () => {
    // Persist the typed location onto the profile before saving. (No geocoding
    // wired yet, so we store the label only; lat/lon stay null — see
    // usePlacesInput.) save() upserts the whole profile via the gateway.
    setLocation(value)
    await save()
    go('empty-groups')
  }

  return (
    <OnboardingLayout
      step={5}
      total={5}
      title="Where do you usually eat?"
      subtitle="Helps us prioritise nearby restaurants. You can change this per session."
    >
      <Input label="DEFAULT LOCATION" value={value} onChange={(e) => setValue(e.target.value)} />

      <div className="flex flex-col gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">
          Max distance
        </span>
        <div className="flex gap-2">
          {DISTANCES.map((d, i) => (
            <button
              key={d}
              className={cn(
                'flex-1 rounded-input border px-3 py-2 text-sm font-medium transition-colors',
                i === 1
                  ? 'border-text bg-surface-inverse text-white'
                  : 'border-border bg-surface-sunken text-text hover:border-border-strong',
              )}
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      {/* Profile summary card */}
      <div className="flex flex-col gap-1.5 rounded-card bg-surface-sunken p-4 text-sm text-text">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">
          Your profile
        </span>
        {dietary.map((d) => (
          <span key={d} className="flex items-center gap-1.5">
            <Icon name="x" size={12} /> {labelFor(DIETARY_RESTRICTIONS, d)}
          </span>
        ))}
        <span className="flex items-center gap-1.5">
          <Icon name="wallet" size={13} /> Budget: ${profile?.budget_min}–${profile?.budget_max} per
          person
        </span>
        <span className="flex items-center gap-1.5">
          <Icon name="map-pin" size={13} /> {value} · within 1 mi
        </span>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="ghost" leftIcon={<Icon name="arrow-left" size={14} />} onClick={() => go('onboarding-4')}>
          Back
        </Button>
        <Button variant="primary" fullWidth onClick={handleDone}>
          Done — let's eat
        </Button>
      </div>
    </OnboardingLayout>
  )
}
