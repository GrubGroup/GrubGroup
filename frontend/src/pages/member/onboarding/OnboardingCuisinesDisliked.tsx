import { Button, Icon } from '@/components/ui'
import { OnboardingLayout } from '@/components/layout/OnboardingLayout'
import { CuisineGroupPicker } from '@/components/profile/CuisineGroupPicker'
import { useProfileStore } from '@/stores/profileStore'
import { useNavStore } from '@/stores/navStore'

// Onboarding step 3 of 5 — cuisines the diner would rather avoid. Writes to
// profile.disliked_cuisines via toggleCuisine (a cuisine can't be both liked
// and disliked — the store drops it from the other list).
export function OnboardingCuisinesDisliked() {
  const go = useNavStore((s) => s.go)
  const disliked = useProfileStore((s) => s.profile?.disliked_cuisines ?? [])
  const toggleCuisine = useProfileStore((s) => s.toggleCuisine)

  return (
    <OnboardingLayout
      step={3}
      total={5}
      title="Anything you'd rather avoid?"
      subtitle="Optional — flag cuisines you'd prefer the group to skip."
    >
      <CuisineGroupPicker selected={disliked} onToggle={(v) => toggleCuisine(v, 'disliked')} />

      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          leftIcon={<Icon name="arrow-left" size={14} />}
          onClick={() => go('onboarding-2')}
        >
          Back
        </Button>
        <Button variant="primary" fullWidth onClick={() => go('onboarding-4')}>
          Continue
        </Button>
        <Button variant="ghost" onClick={() => go('onboarding-4')}>
          Skip
        </Button>
      </div>
    </OnboardingLayout>
  )
}
