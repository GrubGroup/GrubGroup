import { AuthPage } from '@/pages/auth/AuthPage'
import { Onboarding1 } from '@/pages/member/onboarding/Onboarding1'
import { Onboarding2 } from '@/pages/member/onboarding/Onboarding2'
import { Onboarding3 } from '@/pages/member/onboarding/Onboarding3'
import { EmptyGroupsPage } from '@/pages/member/EmptyGroupsPage'
import { GroupChatPage } from '@/pages/member/GroupChatPage'
import { EventsPage } from '@/pages/member/EventsPage'
import { AgentChatPage } from '@/pages/member/session/AgentChatPage'
import { TopPicksPage } from '@/pages/member/session/TopPicksPage'
import { useNavStore } from '@/stores/navStore'
import { useAuthStore } from '@/stores/authStore'
import { USE_MOCK } from '@/lib/env'

// Frontend-only screen switch (no router). Transitions follow the wireframe
// journey (see frontend-user-journey memory).
function App() {
  const screen = useNavStore((s) => s.screen)
  const user = useAuthStore((s) => s.user)

  // Auth guard (live mode only): every screen except the auth pages requires a
  // signed-in user. Mock mode boots pre-authenticated, so this is a no-op there.
  const isAuthScreen = screen === 'sign-in' || screen === 'sign-up'
  if (!USE_MOCK && !user && !isAuthScreen) {
    return <AuthPage mode="signin" />
  }

  switch (screen) {
    case 'sign-in':
      return <AuthPage mode="signin" />
    case 'sign-up':
      return <AuthPage mode="signup" />
    case 'onboarding-1':
      return <Onboarding1 />
    case 'onboarding-2':
      return <Onboarding2 />
    case 'onboarding-3':
      return <Onboarding3 />
    case 'empty-groups':
      return <EmptyGroupsPage />
    // Group-chat context — the session card changes state per screen.
    case 'group-chat':
    case 'session-continue':
    case 'session-waiting':
    case 'scrolled-past':
    case 'session-complete':
      return <GroupChatPage />
    // Agent-chat context.
    case 'agent-chat':
    case 'voice':
    case 'agent-chat-done':
      return <AgentChatPage />
    case 'top-picks':
      return <TopPicksPage />
    case 'events':
      return <EventsPage />
    default:
      return <AuthPage mode="signin" />
  }
}

export default App
