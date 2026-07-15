import { useEffect } from 'react'
import { Avatar, Badge, Button, Icon } from '@/components/ui'
import { AppSidebar } from '@/components/layout/AppSidebar'
import { PreferenceTag } from '@/components/profile/PreferenceTag'
import { CUISINES, DIETARY_RESTRICTIONS, isAllergen, labelFor } from '@/constants/dietary'
import { useAuthStore } from '@/stores/authStore'
import { useProfileStore } from '@/stores/profileStore'
import { useNavStore } from '@/stores/navStore'
import { useRestaurantStore } from '@/stores/restaurantStore'

// Read-only profile view. Composes the domain User (header identity) with the
// Profile (dining preferences). Mirrors the "[Orange] Profile" wireframe.
export function ProfilePage() {
  const go = useNavStore((s) => s.go)
  const user = useAuthStore((s) => s.user)
  const profile = useProfileStore((s) => s.profile)
  const load = useProfileStore((s) => s.load)
  const customAllergies = useProfileStore((s) => s.customAllergies)
  const restaurantsById = useRestaurantStore((s) => s.byId)
  const restaurantsLoaded = useRestaurantStore((s) => s.loaded)
  const loadRestaurants = useRestaurantStore((s) => s.load)

  useEffect(() => {
    if (!profile) void load()
    if (!restaurantsLoaded) void loadRestaurants()
  }, [profile, load, restaurantsLoaded, loadRestaurants])

  const dietary = profile?.dietary_restrictions ?? []
  const allergyValues = dietary.filter(isAllergen)
  const dietValues = dietary.filter((v) => !isAllergen(v))
  const preferred = profile?.preferred_cuisines ?? []
  const disliked = profile?.disliked_cuisines ?? []
  const liked = (profile?.liked_restaurant_ids ?? [])
    .map((id) => restaurantsById[id])
    .filter(Boolean)

  const displayName = user?.display_name ?? user?.username ?? 'You'

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
              onClick={() => go('empty-groups')}
              className="mb-2 flex items-center gap-1 text-sm text-text-muted hover:text-text"
            >
              <Icon name="chevron-left" size={14} /> Back
            </button>
            <h1 className="font-display text-2xl font-bold text-text">Your profile</h1>
            <p className="text-sm text-text-muted">
              Set once — your agent remembers this for every session
            </p>
          </div>
          <Button
            variant="primary"
            leftIcon={<Icon name="pencil" size={14} />}
            onClick={() => go('profile-edit')}
          >
            Edit profile
          </Button>
        </div>

        <div className="flex flex-col gap-8 px-8 py-6">
          {/* Identity row */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Avatar name={displayName} src={user?.avatar_url} size="lg" colorClass="member-purple" />
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-display text-xl font-bold text-text">{displayName}</h2>
                  <Badge tone="neutral">Member</Badge>
                </div>
                <p className="text-sm text-text-muted">
                  @{user?.username ?? 'you'}
                  {user?.email ? ` · ${user.email}` : ''}
                </p>
              </div>
            </div>
            <span className="flex items-center gap-1.5 text-sm font-medium text-text-muted">
              <Icon name="check" size={14} /> Preferences saved
            </span>
          </div>

          {/* Dietary needs */}
          <Section label="Dietary needs">
            {allergyValues.length + dietValues.length + customAllergies.length === 0 ? (
              <Empty>No dietary needs set.</Empty>
            ) : (
              <div className="flex flex-wrap gap-2">
                {allergyValues.map((v) => (
                  <PreferenceTag key={v} tone="allergy">
                    {labelFor(DIETARY_RESTRICTIONS, v)}
                  </PreferenceTag>
                ))}
                {/* Client-only free-text allergies (session scope, not persisted). */}
                {customAllergies.map((v) => (
                  <PreferenceTag key={`custom-${v}`} tone="allergy">
                    {v}
                  </PreferenceTag>
                ))}
                {dietValues.map((v) => (
                  <PreferenceTag key={v} tone="diet">
                    {labelFor(DIETARY_RESTRICTIONS, v)}
                  </PreferenceTag>
                ))}
              </div>
            )}
          </Section>

          {/* Budget + location card */}
          <div className="overflow-hidden rounded-card border border-border">
            <InfoRow
              icon="wallet"
              title="Typical budget"
              value={`$${profile?.budget_min ?? 0}–${profile?.budget_max ?? 0} per person`}
            />
            <div className="h-px bg-border" />
            <InfoRow
              icon="map-pin"
              title="Default location"
              value={profile?.default_location ?? 'Not set'}
            />
          </div>

          {/* Preferred cuisines */}
          <Section label="Preferred cuisines">
            {preferred.length === 0 ? (
              <Empty>No preferred cuisines yet.</Empty>
            ) : (
              <div className="flex flex-wrap gap-2">
                {preferred.map((v) => (
                  <PreferenceTag key={v} tone="preferred">
                    {labelFor(CUISINES, v)}
                  </PreferenceTag>
                ))}
              </div>
            )}
          </Section>

          {/* Disliked cuisines */}
          <Section label="Disliked cuisines">
            {disliked.length === 0 ? (
              <Empty>Nothing to avoid.</Empty>
            ) : (
              <div className="flex flex-wrap gap-2">
                {disliked.map((v) => (
                  <PreferenceTag key={v} tone="disliked" dot={false}>
                    {labelFor(CUISINES, v)}
                  </PreferenceTag>
                ))}
              </div>
            )}
          </Section>

          {/* Liked restaurants */}
          <Section label="Liked restaurants">
            {liked.length === 0 ? (
              <Empty>No favorites yet.</Empty>
            ) : (
              <div className="overflow-hidden rounded-card border border-border">
                {liked.map((r, i) => (
                  <div key={r.id}>
                    {i > 0 && <div className="h-px bg-border" />}
                    <div className="flex items-center gap-3 px-4 py-3.5">
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-sunken text-lg">
                        {r.cuisine_tags?.[0] ? '🍽️' : '🍽️'}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-text">{r.name}</p>
                        <p className="truncate text-xs text-text-muted">
                          {r.cuisine_tags?.[0] ?? 'Restaurant'}
                          {r.price_avg != null ? ` · ~$${r.price_avg}` : ''}
                        </p>
                      </div>
                      <Icon name="heart" size={18} filled className="text-primary" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Section>
        </div>
      </div>
    </div>
  )
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-text-subtle">
        {label}
      </h3>
      {children}
    </section>
  )
}

function InfoRow({
  icon,
  title,
  value,
}: {
  icon: 'wallet' | 'map-pin'
  title: string
  value: string
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-4">
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-sunken text-primary">
        <Icon name={icon} size={16} />
      </span>
      <div>
        <p className="text-sm font-semibold text-text">{title}</p>
        <p className="text-sm text-text-muted">{value}</p>
      </div>
    </div>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-input border border-dashed border-border bg-surface-sunken px-4 py-3 text-sm text-text-muted">
      {children}
    </p>
  )
}
