import { Button, Chip } from '@/components/ui'
import { OnboardingLayout } from '@/components/layout/OnboardingLayout'
import { DIETARY_RESTRICTIONS } from '@/constants/dietary'
import { useProfileStore } from '@/stores/profileStore'
import { useNavStore } from '@/stores/navStore'
import { useEffect } from 'react'

export function Onboarding1() {
  const go = useNavStore((s) => s.go)
  const profile = useProfileStore((s) => s.profile)
  const load = useProfileStore((s) => s.load)
  const dietary = profile?.dietary_restrictions ?? []
  const toggleDietary = useProfileStore((s) => s.toggleDietary)

  useEffect(() => {
    if (!profile) void load()
  }, [profile, load])

  return (
    <OnboardingLayout
      step={1}
      total={3}
      title="Any dietary needs?"
      subtitle="Set once — the AI remembers for every session. You'll never be asked again."
    >
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
      <div className="flex items-center gap-2">
        <Button variant="primary" fullWidth onClick={() => go('onboarding-2')}>
          Continue
        </Button>
        <Button variant="ghost" onClick={() => go('onboarding-2')}>
          Skip
        </Button>
      </div>
    </OnboardingLayout>
  )
}
