import { Avatar, Badge, Icon } from '@/components/ui'
import { AppSidebar } from '@/components/layout/AppSidebar'
import {
  FEATURED_EVENT,
  PAST_EVENTS,
  UPCOMING_EVENTS,
  type EventLite,
} from '@/api/mock/events.mock'
import { MOCK_MEMBER_COLORS, MOCK_MEMBER_NAMES } from '@/api/mock/session.mock'

function Stars({ n }: { n: number }) {
  return (
    <span className="flex items-center gap-0.5" aria-label={`${n} stars`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <span key={i} className={i < n ? 'text-primary' : 'text-text-subtle'}>
          <Icon name="star" size={11} filled={i < n} />
        </span>
      ))}
    </span>
  )
}

function EventRow({ e }: { e: EventLite }) {
  return (
    <div className="flex items-center gap-3 border-b border-border px-4 py-3">
      <span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-surface-raised text-lg">
        {e.emoji}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-[13px] font-semibold text-text">{e.restaurantName}</span>
          {e.rating ? (
            <Stars n={e.rating} />
          ) : (
            <span className="text-[10px] text-text-muted">{e.date}</span>
          )}
        </div>
        <p className="truncate text-xs text-text-muted">
          {e.time ? `📍 ${e.time}` : `${e.group} · ${e.date}`}
          {e.confirmed && <span className="ml-1 text-success">{e.confirmed}</span>}
        </p>
      </div>
    </div>
  )
}

export function EventsPage() {
  return (
    <div className="flex h-screen overflow-hidden bg-surface-raised">
      <AppSidebar activeTab="events">
        <p className="px-4 pt-3 text-[10px] font-semibold uppercase tracking-wide text-text-muted">
          Upcoming
        </p>
        {UPCOMING_EVENTS.map((e) => (
          <EventRow key={e.id} e={e} />
        ))}
        <p className="px-4 pt-3 text-[10px] font-semibold uppercase tracking-wide text-text-muted">
          Past
        </p>
        {PAST_EVENTS.map((e) => (
          <EventRow key={e.id} e={e} />
        ))}
      </AppSidebar>

      {/* Detail */}
      <div className="flex flex-1 flex-col overflow-y-auto">
        {/* Hero */}
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
      </div>
    </div>
  )
}
