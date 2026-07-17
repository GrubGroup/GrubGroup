import type { ReactNode } from 'react'
import { useState } from 'react'
import { Avatar, Icon, type IconName } from '@/components/ui'
import { AccountMenu } from './AccountMenu'
import { useAuthStore } from '@/stores/authStore'
import { useNavStore } from '@/stores/navStore'
import { useGroupsStore } from '@/stores/groupsStore'
import { signOut } from '@/lib/authClient'
import { cn } from '@/utils/cn'

// Shared height for the top row of EVERY column (sidebar panel header, chat
// header, right panel header) so their bottom borders line up seamlessly.
export const COLUMN_HEADER_H = 'h-[61px]'

type SidebarTab = 'groups' | 'events'

export interface AppSidebarProps {
  /** Which rail tab is active; omit to render the rail with no active tab. */
  activeTab?: SidebarTab
  /** Panel title shown in the header (e.g. "Groups", "Events"). */
  title?: string
  /** Optional action rendered on the right of the panel header (e.g. add button). */
  headerAction?: ReactNode
  /** Scrollable panel body — group list, events list, or an empty-state block. */
  children: ReactNode
  /** Show the current-user avatar + account menu on the rail. */
  showFooter?: boolean
  /** Hide the whole column on small screens (used by the marketing empty state). */
  responsive?: boolean
  /** Panel width utility (default 'w-56'). The group-chat list passes a wider
   * value so its chats have more breathing room. */
  panelWidth?: string
}

// The single left column used across group chat, agent chat, events, and the
// empty state. An icon rail (brand + section tabs + user avatar) plus a titled
// panel with a body slot. Rail tabs switch between the groups and events
// contexts; behavior mirrors the previous tab bar.
export function AppSidebar({
  activeTab,
  title,
  headerAction,
  children,
  showFooter = true,
  responsive = false,
  panelWidth = 'w-56',
}: AppSidebarProps) {
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const resetGroups = useGroupsStore((s) => s.reset)
  const go = useNavStore((s) => s.go)
  const openProfile = useNavStore((s) => s.openProfile)
  const [menuOpen, setMenuOpen] = useState(false)

  // Clear the Better Auth session (cookie) + local state, then return to sign-in.
  const handleSignOut = async () => {
    await signOut()
    logout()
    resetGroups()
    go('sign-in')
  }

  const displayName = user?.display_name ?? user?.username ?? 'You'

  return (
    <aside
      className={cn(
        'shrink-0 border-r border-border',
        responsive ? 'hidden md:flex' : 'flex',
      )}
    >
      {/* Icon rail */}
      <div className="flex w-16 flex-col items-center gap-1.5 border-r border-border bg-surface-sunken px-3 pb-4 pt-4">
        {/* Brand badge */}
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-surface-inverse text-white">
          <Icon name="utensils" size={16} />
        </span>

        <div className="mt-2 flex flex-col items-center gap-1.5">
          <RailButton
            icon="users"
            label="Groups"
            active={activeTab === 'groups'}
            onClick={() => go('group-chat')}
          />
          <RailButton
            icon="calendar"
            label="Events"
            active={activeTab === 'events'}
            onClick={() => go('events')}
          />
        </div>

        {/* Spacer pushes the user avatar to the bottom */}
        <div className="flex-1" />

        {showFooter && (
          <div className="relative">
            <AccountMenu
              open={menuOpen}
              onClose={() => setMenuOpen(false)}
              displayName={displayName}
              username={user?.username ?? 'you'}
              avatarUrl={user?.avatar_url}
              onViewProfile={() => openProfile()}
              onSignOut={handleSignOut}
              // Opens beside the rail avatar (bottom-aligned to the right).
              positionClass="bottom-0 left-full ml-2 w-56"
            />
            <button
              onClick={() => setMenuOpen((o) => !o)}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-label="Account menu"
              className="rounded-pill focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
            >
              <Avatar name={displayName} src={user?.avatar_url} size="md" colorClass="member-purple" />
            </button>
          </div>
        )}
      </div>

      {/* Panel */}
      <div className={cn('flex flex-col bg-surface-panel', panelWidth)}>
        {/* Panel header — same height as every column header */}
        <div
          className={cn(
            'flex items-center justify-between gap-2 border-b border-border pl-4 pr-3.5',
            COLUMN_HEADER_H,
          )}
        >
          <span className="min-w-0 flex-1 truncate font-display text-[20px] font-bold text-text">
            {title ?? 'GrubGroup'}
          </span>
          {headerAction}
        </div>

        {/* Body */}
        <div className="flex flex-1 flex-col overflow-y-auto">{children}</div>
      </div>
    </aside>
  )
}

function RailButton({
  icon,
  label,
  active,
  onClick,
}: {
  icon: IconName
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'relative flex h-10 w-10 items-center justify-center rounded-xl transition-colors',
        active
          ? 'bg-surface-inverse text-white'
          : 'text-text-muted hover:bg-surface-raised/70 hover:text-text',
      )}
    >
      <Icon name={icon} size={18} />
    </button>
  )
}
