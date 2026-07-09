import { Button, Icon, type IconName } from '@/components/ui'
import { AppSidebar } from '@/components/layout/AppSidebar'
import { useNavStore } from '@/stores/navStore'

const HOW_IT_WORKS: { icon: IconName; title: string; body: string }[] = [
  {
    icon: 'message',
    title: 'Chat with your group',
    body: 'Start a session from any group chat. Everyone gets a private conversation with their own AI food agent.',
  },
  {
    icon: 'mic',
    title: 'Tell it what you want',
    body: 'Talk or type — share your mood, budget, dietary needs, and location. The agent remembers everything from your profile.',
  },
  {
    icon: 'utensils',
    title: 'One perfect pick',
    body: 'The AI finds restaurants that work for your whole group at once. Vote on the top picks and confirm in seconds.',
  },
]

export function EmptyGroupsPage() {
  const go = useNavStore((s) => s.go)

  return (
    <div className="flex h-screen bg-surface-raised">
      {/* Empty-state sidebar (no tabs, no footer) */}
      <AppSidebar showFooter={false} responsive>
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-pill bg-surface-sunken text-text-muted">
            <Icon name="users" size={22} />
          </span>
          <p className="font-semibold text-text">No groups yet</p>
          <p className="text-xs text-text-muted">
            Create a group with friends, coworkers, or a date to start finding restaurants together.
          </p>
          <div className="mt-2 flex w-full flex-col gap-2">
            <Button variant="primary" fullWidth onClick={() => go('group-chat')}>
              Create a group
            </Button>
            <Button variant="ghost" fullWidth onClick={() => go('group-chat')}>
              Join with a link
            </Button>
          </div>
        </div>
      </AppSidebar>

      {/* Hero */}
      <div className="flex flex-1 flex-col items-center overflow-y-auto">
        <div className="flex w-full items-center justify-between border-b border-border px-6 py-3 text-xs text-text-muted">
          <span>New user · no groups yet</span>
          <div className="flex gap-2">
            <button onClick={() => go('sign-in')} className="rounded-input border border-border px-3 py-1">
              Sign in
            </button>
          </div>
        </div>

        <div className="flex max-w-lg flex-col items-center gap-4 px-6 py-16 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-inverse text-white">
            <Icon name="utensils" size={26} />
          </span>
          <h1 className="font-display text-4xl font-bold leading-tight text-text">
            Find restaurants
            <br />
            your whole group loves
          </h1>
          <p className="text-text-muted">
            Everyone tells their own AI agent what they want. GrubGroup finds the one restaurant
            that works for all of you.
          </p>
          <div className="mt-2 flex gap-3">
            <Button variant="primary" leftIcon={<Icon name="plus" size={14} />} onClick={() => go('group-chat')}>
              Create a group
            </Button>
            <Button variant="ghost" onClick={() => go('group-chat')}>
              Join with a link
            </Button>
          </div>
        </div>

        <div className="w-full max-w-4xl px-6 pb-16">
          <p className="mb-6 text-center text-xs font-semibold uppercase tracking-wide text-text-muted">
            How it works
          </p>
          <div className="grid gap-8 md:grid-cols-3">
            {HOW_IT_WORKS.map((s) => (
              <div key={s.title} className="flex flex-col gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-pill bg-surface-sunken text-text-muted">
                  <Icon name={s.icon} size={16} />
                </span>
                <h3 className="font-semibold text-text">{s.title}</h3>
                <p className="text-sm text-text-muted">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
