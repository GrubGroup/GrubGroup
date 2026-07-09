import { Input } from '@/components/ui'
import { usePlacesInput } from '@/hooks/usePlacesInput'
import { useProfileStore } from '@/stores/profileStore'

export function LocationField() {
  const preferredLocation = useProfileStore((s) => s.preferredLocation)
  const setPreferredLocation = useProfileStore((s) => s.setPreferredLocation)
  const { value, setValue } = usePlacesInput(preferredLocation?.label ?? '')

  return (
    <fieldset className="flex flex-col gap-3">
      <div>
        <legend className="font-display text-lg font-semibold text-text">
          Where do you usually eat?
        </legend>
        <p className="text-sm text-text-muted">
          Helps us prioritise nearby restaurants. Optional — you can set this per session too.
        </p>
      </div>
      <Input
        placeholder="e.g. Near Market St, San Francisco"
        value={value}
        onChange={(e) => {
          setValue(e.target.value)
          setPreferredLocation(
            e.target.value ? { mode: 'named', label: e.target.value } : undefined,
          )
        }}
      />
    </fieldset>
  )
}
