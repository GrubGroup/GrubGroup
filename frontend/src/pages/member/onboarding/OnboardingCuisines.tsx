import { Button, Icon } from '@/components/ui'
import { OnboardingLayout } from '@/components/layout/OnboardingLayout'
import { CuisineTriStatePicker } from '@/components/profile/CuisineTriStatePicker'
import { useProfileStore } from '@/stores/profileStore'
import { useNavStore } from '@/stores/navStore'

// Onboarding step 2 of 4 — like/avoid cuisines in a single tri-state step. Each
// chip cycles neutral → like → avoid → neutral, so a cuisine can never be both.
// Writes through setCuisineState (preferred/disliked kept mutually exclusive).
export function OnboardingCuisines() {
  const go = useNavStore((s) => s.go)
  const preferred = useProfileStore((s) => s.profile?.preferred_cuisines ?? [])
  const disliked = useProfileStore((s) => s.profile?.disliked_cuisines ?? [])
  const setCuisineState = useProfileStore((s) => s.setCuisineState)

  return (
    <OnboardingLayout
      step={2}
      total={4}
      title="Cuisines you love or avoid"
      subtitle="Tell your agent what to lean toward and what to skip — all in one place."
    >
      <CuisineTriStatePicker liked={preferred} disliked={disliked} onCycle={setCuisineState} />

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
