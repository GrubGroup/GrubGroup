import { Button, Icon } from '@/components/ui'
import { OnboardingLayout } from '@/components/layout/OnboardingLayout'
import { CuisineGroupPicker } from '@/components/profile/CuisineGroupPicker'
import { useProfileStore } from '@/stores/profileStore'
import { useNavStore } from '@/stores/navStore'

// Onboarding step 2 of 5 — cuisines the diner loves. Writes to
// profile.preferred_cuisines via the store's toggleCuisine (which also enforces
// the preferred/disliked mutual exclusion).
export function OnboardingCuisinesLiked() {
  const go = useNavStore((s) => s.go)
  const preferred = useProfileStore((s) => s.profile?.preferred_cuisines ?? [])
  const toggleCuisine = useProfileStore((s) => s.toggleCuisine)

  return (
    <OnboardingLayout
      step={2}
      total={5}
      title="Cuisines you love"
      subtitle="Pick as many as you like — your agent leans toward these when finding a match."
    >
      <CuisineGroupPicker selected={preferred} onToggle={(v) => toggleCuisine(v, 'preferred')} />

      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          leftIcon={<Icon name="arrow-left" size={14} />}
          onClick={() => go('onboarding-1')}
        >
          Back
        </Button>
        <Button variant="primary" fullWidth onClick={() => go('onboarding-3')}>
          Continue
        </Button>
        <Button variant="ghost" onClick={() => go('onboarding-3')}>
          Skip
        </Button>
      </div>
    </OnboardingLayout>
  )
}
