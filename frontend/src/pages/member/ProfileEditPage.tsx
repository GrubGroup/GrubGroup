import { useEffect, useState } from 'react'
import { Avatar, Button, Chip, Icon, Input } from '@/components/ui'
import { AppSidebar } from '@/components/layout/AppSidebar'
import { CustomAllergyInput } from '@/components/profile/CustomAllergyInput'
import { CUISINES, DIETARY_RESTRICTIONS, isAllergen } from '@/constants/dietary'
import { updateMe, UserUpdateError } from '@/api/user.api'
import { useAuthStore } from '@/stores/authStore'
import { useProfileStore } from '@/stores/profileStore'
import { useNavStore } from '@/stores/navStore'

const DIET_OPTIONS = DIETARY_RESTRICTIONS.filter((o) => !isAllergen(o.value))
const ALLERGEN_OPTIONS = DIETARY_RESTRICTIONS.filter((o) => isAllergen(o.value))

const BUDGET_BANDS = [
  { label: 'Under $15', min: 0, max: 15 },
  { label: '$15–25', min: 15, max: 25 },
  { label: '$25–40', min: 25, max: 40 },
  { label: '$40+', min: 40, max: 200 },
]

// Edit form for identity (User: display_name, username) + preferences (Profile).
// Mirrors the "[Orange] Edit Profile" wireframe. Saves User via PATCH /user
// (with username-uniqueness error surfacing) and Profile via the profile store.
export function ProfileEditPage() {
  const go = useNavStore((s) => s.go)
  const user = useAuthStore((s) => s.user)
  const patchUser = useAuthStore((s) => s.patchUser)

  const profile = useProfileStore((s) => s.profile)
  const load = useProfileStore((s) => s.load)
  const save = useProfileStore((s) => s.save)
  const saving = useProfileStore((s) => s.saving)
  const toggleDietary = useProfileStore((s) => s.toggleDietary)
  const toggleCuisine = useProfileStore((s) => s.toggleCuisine)
  const setBudget = useProfileStore((s) => s.setBudget)
  const setLocation = useProfileStore((s) => s.setLocation)
  const customAllergies = useProfileStore((s) => s.customAllergies)
  const setCustomAllergies = useProfileStore((s) => s.setCustomAllergies)

  // Local identity draft (User fields aren't in the profile store).
  const [displayName, setDisplayName] = useState('')
  const [username, setUsername] = useState('')
  const [location, setLocationDraft] = useState('')
  const [usernameError, setUsernameError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [savingUser, setSavingUser] = useState(false)

  useEffect(() => {
    if (!profile) void load()
  }, [profile, load])

  // Seed local drafts once user/profile are available.
  useEffect(() => {
    if (user) {
      setDisplayName(user.display_name ?? '')
      setUsername(user.username ?? '')
    }
  }, [user])
  useEffect(() => {
    if (profile) setLocationDraft(profile.default_location ?? '')
  }, [profile])

  const dietary = profile?.dietary_restrictions ?? []
  const preferred = profile?.preferred_cuisines ?? []
  const disliked = profile?.disliked_cuisines ?? []
  const budgetMin = profile?.budget_min ?? 15
  const budgetMax = profile?.budget_max ?? 25

  const handleSave = async () => {
    setFormError(null)
    setUsernameError(null)

    // 1) Persist identity (User) first so a username conflict aborts before we
    //    save preferences — the user stays on the form with the error shown.
    const identityPatch: { display_name?: string | null; username?: string } = {}
    if (displayName !== (user?.display_name ?? '')) identityPatch.display_name = displayName || null
    if (username !== (user?.username ?? '')) identityPatch.username = username

    if (Object.keys(identityPatch).length > 0) {
      setSavingUser(true)
      try {
        const updated = await updateMe(identityPatch)
        patchUser(updated)
      } catch (err) {
        setSavingUser(false)
        if (err instanceof UserUpdateError && err.status === 409) {
          setUsernameError(err.message)
        } else if (err instanceof UserUpdateError && err.status === 400) {
          setUsernameError(err.message)
        } else {
          setFormError(err instanceof Error ? err.message : 'Could not save your account.')
        }
        return
      }
      setSavingUser(false)
    }

    // 2) Persist preferences (Profile). Fold the location draft in first.
    setLocation(location)
    await save()
    go('profile')
  }

  const displayNameLabel = displayName || user?.username || 'You'

  return (
    <div className="flex h-screen overflow-hidden bg-surface-raised">
      <AppSidebar showFooter>
        <div className="p-4 text-sm text-text-muted">Your account</div>
      </AppSidebar>

      <div className="flex flex-1 flex-col overflow-y-auto">
        {/* Header bar */}
        <div className="flex items-start justify-between gap-4 border-b border-border px-8 py-6">
          <div>
            <button
              onClick={() => go('profile')}
              className="mb-2 flex items-center gap-1 text-sm text-text-muted hover:text-text"
            >
              <Icon name="chevron-left" size={14} /> Back
            </button>
            <h1 className="font-display text-2xl font-bold text-text">Edit profile</h1>
            <p className="text-sm text-text-muted">
              Update your details — your agent uses these across every session
            </p>
          </div>
          <Button variant="ghost" onClick={() => go('profile')}>
            Cancel
          </Button>
        </div>

        <div className="flex max-w-3xl flex-col gap-7 px-8 py-6">
          {/* Profile photo */}
          <Field label="Profile photo">
            <div className="flex items-center gap-4 rounded-card border border-border p-4">
              <Avatar name={displayNameLabel} src={user?.avatar_url} size="lg" colorClass="member-purple" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-text">{displayNameLabel}</p>
                <p className="text-xs text-text-muted">PNG or JPG, up to 5MB</p>
              </div>
              <Button variant="primary" size="sm" leftIcon={<Icon name="plus" size={13} />} disabled>
                Change photo
              </Button>
            </div>
          </Field>

          {/* Identity */}
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <Field label="Display name">
              <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Dev Patel" />
            </Field>
            <Field label="Username">
              <Input
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value)
                  if (usernameError) setUsernameError(null)
                }}
                placeholder="devpatel"
                error={usernameError ?? undefined}
                hint={usernameError ? undefined : '3–30 chars: letters, numbers, dots, underscores.'}
              />
            </Field>
          </div>

          <Field label="Default location">
            <Input
              value={location}
              onChange={(e) => setLocationDraft(e.target.value)}
              leftIcon={<Icon name="map-pin" size={16} />}
              placeholder="e.g. Market Street, San Francisco"
            />
          </Field>

          {/* Budget */}
          <Field label="Typical budget (per person)">
            <div className="flex flex-wrap gap-2">
              {BUDGET_BANDS.map((b) => (
                <Chip
                  key={b.label}
                  label={b.label}
                  selected={b.min === budgetMin && b.max === budgetMax}
                  onToggle={() => setBudget(b.min, b.max)}
                />
              ))}
            </div>
          </Field>

          {/* Dietary needs */}
          <Field label="Dietary needs">
            <div className="flex flex-wrap gap-2">
              {DIET_OPTIONS.map((opt) => (
                <Chip
                  key={opt.value}
                  label={opt.label}
                  selected={dietary.includes(opt.value)}
                  onToggle={() => toggleDietary(opt.value)}
                />
              ))}
            </div>
          </Field>

          {/* Allergies */}
          <Field label="Allergies">
            <div className="flex flex-wrap gap-2">
              {ALLERGEN_OPTIONS.map((opt) => (
                <Chip
                  key={opt.value}
                  label={opt.label}
                  selected={dietary.includes(opt.value)}
                  onToggle={() => toggleDietary(opt.value)}
                />
              ))}
            </div>
            <CustomAllergyInput value={customAllergies} onChange={setCustomAllergies} className="mt-2" />
          </Field>

          {/* Preferred cuisines */}
          <Field label="Preferred cuisines">
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
          </Field>

          {/* Disliked cuisines */}
          <Field label="Disliked cuisines">
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
          </Field>

          {formError && <p className="text-sm text-error">{formError}</p>}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 border-t border-border pt-5">
            <Button variant="ghost" onClick={() => go('profile')}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSave} isLoading={saving || savingUser}>
              Save changes
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-text-subtle">
        {label}
      </span>
      {children}
    </div>
  )
}
