import { useEffect, useState } from 'react'
import type { EventRecord } from '@/types'
import { Avatar, Badge, Icon } from '@/components/ui'
import { AppSidebar } from '@/components/layout/AppSidebar'
import { FEATURED_EVENT } from '@/api/mock/events.mock'
import { MOCK_MEMBER_COLORS, MOCK_MEMBER_NAMES } from '@/api/mock/session.mock'
import { useEventListStore } from '@/stores/eventListStore'

// A cuisine/dietary emoji is not on the API row, so pick a stable default.
const EVENT_EMOJI = '🍽️'

function EventRow({
  e,
  active,
  onSelect,
}: {
  e: EventRecord
  active: boolean
  onSelect: () => void
}) {
  return (
    <button
      onClick={onSelect}
      className={
        active
          ? 'flex w-full items-center gap-3 border-b border-border bg-surface-sunken px-4 py-3 text-left'
          : 'flex w-full items-center gap-3 border-b border-border px-4 py-3 text-left hover:bg-surface-sunken/50'
      }
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-surface-raised text-lg">
        {EVENT_EMOJI}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-[13px] font-semibold text-text">{e.restaurant_name}</span>
          <span className="shrink-0 text-[10px] text-text-muted">{e.time_slot ?? ''}</span>
        </div>
        <p className="truncate text-xs text-text-muted">
          {e.occasion ? `${e.occasion} · ` : ''}
          {e.group_name ?? 'Group'}
        </p>
      </div>
    </button>
  )
}

export function EventsPage() {
  const events = useEventListStore((s) => s.events)
  const loaded = useEventListStore((s) => s.loaded)
  const load = useEventListStore((s) => s.load)
  const [selectedId, setSelectedId] = useState<number | null>(null)

  useEffect(() => {
    void load()
  }, [load])

  const active = events.find((e) => e.id === selectedId) ?? events[0] ?? null

  return (
    <div className="flex h-screen overflow-hidden bg-surface-raised">
      <AppSidebar activeTab="events">
        <p className="px-4 pt-3 text-[10px] font-semibold uppercase tracking-wide text-text-muted">
          Your events
        </p>
        {loaded && events.length === 0 && (
          <p className="px-4 py-6 text-sm text-text-muted">
            No events yet. Start a session and confirm a pick to book one.
          </p>
        )}
        {events.map((e) => (
          <EventRow
            key={e.id}
            e={e}
            active={active?.id === e.id}
            onSelect={() => setSelectedId(e.id)}
          />
        ))}
      </AppSidebar>

      {/* Detail */}
      <div className="flex flex-1 flex-col overflow-y-auto">
        {active ? (
          <>
            <div className="relative flex h-56 shrink-0 flex-col justify-end bg-surface-inverse p-6 text-white">
              <span className="absolute right-6 top-6 text-xs text-white/70">
                {active.time_slot ?? ''}
              </span>
              <p className="text-xs text-white/70">
                📍 {active.address ?? active.group_name ?? 'Location TBD'}
              </p>
              <h1 className="font-display text-3xl font-bold">{active.restaurant_name}</h1>
              {active.occasion && <p className="text-sm text-white/80">{active.occasion}</p>}
            </div>

            <div className="flex flex-col gap-5 p-6">
              <div className="flex flex-wrap gap-2">
                <Badge tone="neutral">
                  <Icon name="map-pin" size={11} /> {active.address ?? 'Address TBD'}
                </Badge>
                {active.group_name && (
                  <Badge tone="neutral">
                    <Icon name="users" size={11} /> {active.group_name}
                  </Badge>
                )}
              </div>

              <div className="rounded-card bg-surface-sunken p-4">
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-muted">
                  Details
                </p>
                <p className="text-sm text-text-muted">
                  {active.occasion ? `${active.occasion} at ` : 'Dining at '}
                  {active.restaurant_name}
                  {active.time_slot ? ` · ${active.time_slot}` : ''}.
                </p>
              </div>

              {/* Participants — everyone who was in the session this event came
                  from (gateway joins Event.attendees). */}
              {active.attendees && active.attendees.length > 0 && (
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                      Who's going
                    </p>
                    <span className="text-xs text-text-muted">
                      {active.attendees.length}{' '}
                      {active.attendees.length === 1 ? 'person' : 'people'}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    {active.attendees.map((a) => {
                      const name = a.display_name ?? a.username
                      return (
                        <div
                          key={a.id}
                          className="flex items-center gap-3 border-b border-border py-2.5 last:border-b-0"
                        >
                          <Avatar name={name} size="sm" colorClass={MOCK_MEMBER_COLORS[a.id]} />
                          <span className="flex-1 text-sm text-text">{name}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <FeaturedFallback />
        )}
      </div>
    </div>
  )
}

// Shown before any real events exist (or while loading in mock) — reuses the
// original mock hero so the page never looks empty during the demo.
function FeaturedFallback() {
  return (
    <>
      <div className="relative flex h-56 shrink-0 flex-col justify-end bg-surface-inverse p-6 text-white">
        <span className="absolute right-6 top-6 text-xs text-white/70">
          Upcoming · {FEATURED_EVENT.time}
        </span>
        <p className="text-xs text-white/70">
          📍 {FEATURED_EVENT.group} · {FEATURED_EVENT.date}
        </p>
        <h1 className="font-display text-3xl font-bold">{FEATURED_EVENT.restaurantName}</h1>
        <p className="text-sm text-white/80">$ · {FEATURED_EVENT.confirmed} confirmed</p>
      </div>

      <div className="flex flex-col gap-5 p-6">
        <div className="flex gap-2">
          {FEATURED_EVENT.dietary.map((d) => (
            <Badge key={d} tone="success">
              {d}
            </Badge>
          ))}
        </div>

        <div className="rounded-card bg-surface-sunken p-4">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-muted">
            Why this was picked
          </p>
          <p className="text-sm text-text-muted">{FEATURED_EVENT.why}</p>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
              Who's going
            </p>
            <span className="text-xs text-text-muted">{FEATURED_EVENT.confirmed} confirmed</span>
          </div>
          <div className="flex flex-col">
            {FEATURED_EVENT.attendees.map((a) => (
              <div
                key={a.userId}
                className="flex items-center gap-3 border-b border-border py-2.5 last:border-b-0"
              >
                <Avatar
                  name={MOCK_MEMBER_NAMES[a.userId] ?? '?'}
                  size="sm"
                  colorClass={MOCK_MEMBER_COLORS[a.userId]}
                />
                <span className="flex-1 text-sm text-text">
                  {MOCK_MEMBER_NAMES[a.userId] ?? '?'}
                </span>
                <span
                  className={
                    a.status === 'Confirmed'
                      ? 'flex items-center gap-1 text-sm text-success'
                      : 'text-sm text-text-muted'
                  }
                >
                  {a.status === 'Confirmed' && <Icon name="check" size={13} />}
                  {a.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
