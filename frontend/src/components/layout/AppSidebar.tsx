import type { ReactNode } from 'react'
import { useState } from 'react'
import { Avatar, Icon } from '@/components/ui'
import { AccountMenu } from './AccountMenu'
import { useAuthStore } from '@/stores/authStore'
import { useNavStore } from '@/stores/navStore'
import { useGroupsStore } from '@/stores/groupsStore'
import { signOut } from '@/lib/authClient'
import { cn } from '@/utils/cn'

// Shared height for the top row of EVERY column (sidebar brand, chat header,
// right panel header) so their bottom borders line up seamlessly.
export const COLUMN_HEADER_H = 'h-[61px]'

type SidebarTab = 'groups' | 'events'

export interface AppSidebarProps {
  /** Which tab is active; omit to hide the tab bar (e.g. empty state). */
  activeTab?: SidebarTab
  /** Scrollable body — group list, events list, or an empty-state block. */
  children: ReactNode
  /** Show the current-user footer row. */
  showFooter?: boolean
  /** Hide on small screens (used by the marketing-style empty state). */
  responsive?: boolean
}

// The single left column used across group chat, agent chat, events, and the
// empty state. Brand row + optional tabs + body slot + optional user footer.
export function AppSidebar({
  activeTab,
  children,
  showFooter = true,
  responsive = false,
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
        'w-72 shrink-0 flex-col border-r border-border bg-surface-panel',
        responsive ? 'hidden md:flex' : 'flex',
      )}
    >
      {/* Brand row — same height as every column header */}
      <div className={cn('flex items-center gap-2.5 border-b border-border px-5', COLUMN_HEADER_H)}>
        <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-surface-inverse text-white">
          <Icon name="utensils" size={14} />
        </span>
        <span className="font-display text-[15px] font-bold text-text">GrubGroup</span>
      </div>

      {/* Tabs */}
      {activeTab && (
        <div className="flex border-b border-border px-4 pt-3">
          <TabButton label="Groups" active={activeTab === 'groups'} onClick={() => go('group-chat')} />
          <TabButton label="Events" active={activeTab === 'events'} onClick={() => go('events')} />
        </div>
      )}

      {/* Body */}
      <div className="flex flex-1 flex-col overflow-y-auto">{children}</div>

      {/* Footer: current user — opens the account menu popover */}
      {showFooter && (
        <div className="relative border-t border-border px-3 py-3">
          <AccountMenu
            open={menuOpen}
            onClose={() => setMenuOpen(false)}
            displayName={displayName}
            username={user?.username ?? 'you'}
            avatarUrl={user?.avatar_url}
            onViewProfile={() => openProfile()}
            onSignOut={handleSignOut}
          />
          <button
            onClick={() => setMenuOpen((o) => !o)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left hover:bg-surface-raised/60"
          >
            <Avatar name={displayName} src={user?.avatar_url} size="sm" colorClass="member-purple" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold text-text">{displayName}</p>
              <p className="truncate text-[10px] text-text-muted">Preferences saved</p>
            </div>
            <Icon name="chevron-left" size={14} className="rotate-90 text-text-muted" />
          </button>
        </div>
      )}
    </aside>
  )
}

function TabButton({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex-1 border-b-2 pb-2.5 text-xs font-semibold transition-colors',
        active ? 'border-text text-text' : 'border-transparent text-text-muted hover:text-text',
      )}
    >
      {label}
    </button>
  )
}
