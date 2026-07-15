import { AuthPage } from '@/pages/auth/AuthPage'
import { Onboarding1 } from '@/pages/member/onboarding/Onboarding1'
import { OnboardingCuisinesLiked } from '@/pages/member/onboarding/OnboardingCuisinesLiked'
import { OnboardingCuisinesDisliked } from '@/pages/member/onboarding/OnboardingCuisinesDisliked'
import { Onboarding2 } from '@/pages/member/onboarding/Onboarding2'
import { Onboarding3 } from '@/pages/member/onboarding/Onboarding3'
import { EmptyGroupsPage } from '@/pages/member/EmptyGroupsPage'
import { GroupChatPage } from '@/pages/member/GroupChatPage'
import { EventsPage } from '@/pages/member/EventsPage'
import { AgentChatPage } from '@/pages/member/session/AgentChatPage'
import { TopPicksPage } from '@/pages/member/session/TopPicksPage'
import { ProfilePage } from '@/pages/member/ProfilePage'
import { ProfileEditPage } from '@/pages/member/ProfileEditPage'
import { useEffect } from 'react'
import { useNavStore } from '@/stores/navStore'
import { useAuthStore } from '@/stores/authStore'
import { useSession } from '@/lib/authClient'
import { USE_MOCK } from '@/lib/env'
import type { SessionUser } from '@/stores/authStore'

// Frontend-only screen switch (no router). Transitions follow the wireframe
// journey (see frontend-user-journey memory).
function App() {
  const screen = useNavStore((s) => s.screen)
  const go = useNavStore((s) => s.go)
  const user = useAuthStore((s) => s.user)
  const setSessionUser = useAuthStore((s) => s.setSessionUser)

  // Live mode: mirror Better Auth's session (httpOnly cookie) into the store, so
  // the guard and pages read a single source of truth and survive refresh. Mock
  // mode boots pre-authenticated and skips this.
  const { data: session, isPending } = useSession()
  useEffect(() => {
    if (USE_MOCK) return
    setSessionUser((session?.user as SessionUser | undefined) ?? null)
  }, [session, setSessionUser])

  const isAuthScreen = screen === 'sign-in' || screen === 'sign-up'

  // After Google OAuth the browser reloads fresh at the app origin with the
  // nav store defaulted to 'sign-in'. Once the session resolves, move an
  // authenticated user off the auth screens into the app.
  useEffect(() => {
    if (USE_MOCK) return
    if (session?.user && isAuthScreen) go('empty-groups')
  }, [session, isAuthScreen, go])

  // Auth guard (live mode only): every screen except the auth pages requires a
  // signed-in user. Wait for the initial session check before bouncing.
  if (!USE_MOCK && !isPending && !user && !isAuthScreen) {
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
      return <OnboardingCuisinesLiked />
    case 'onboarding-3':
      return <OnboardingCuisinesDisliked />
    case 'onboarding-4':
      return <Onboarding2 />
    case 'onboarding-5':
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
    case 'profile':
      return <ProfilePage />
    case 'profile-edit':
      return <ProfileEditPage />
    default:
      return <AuthPage mode="signin" />
  }
}

export default App
