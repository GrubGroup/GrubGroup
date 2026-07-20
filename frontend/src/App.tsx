import { AuthPage } from '@/pages/auth/AuthPage'
import { LandingPage } from '@/pages/public/LandingPage'
import { Onboarding1 } from '@/pages/member/onboarding/Onboarding1'
import { OnboardingCuisines } from '@/pages/member/onboarding/OnboardingCuisines'
import { Onboarding2 } from '@/pages/member/onboarding/Onboarding2'
import { Onboarding3 } from '@/pages/member/onboarding/Onboarding3'
import { EmptyGroupsPage } from '@/pages/member/EmptyGroupsPage'
import { GroupChatPage } from '@/pages/member/GroupChatPage'
import { EventsPage } from '@/pages/member/EventsPage'
import { AgentChatPage } from '@/pages/member/session/AgentChatPage'
import { TopPicksPage } from '@/pages/member/session/TopPicksPage'
import { ProfilePage } from '@/pages/member/ProfilePage'
import { ProfileEditPage } from '@/pages/member/ProfileEditPage'
import { useEffect, useRef, useState } from 'react'
import { AppSplash } from '@/components/layout/AppSplash'
import { useNavStore } from '@/stores/navStore'
import { useAuthStore } from '@/stores/authStore'
import { useGroupsStore, mostRecentGroup } from '@/stores/groupsStore'
import { useSession } from '@/lib/authClient'
import { fetchProfile } from '@/api/profile.api'
import { USE_MOCK } from '@/lib/env'
import type { SessionUser } from '@/stores/authStore'

// Frontend-only screen switch (no router). Transitions follow the wireframe
// journey (see frontend-user-journey memory).
function App() {
  const screen = useNavStore((s) => s.screen)
  const go = useNavStore((s) => s.go)
  const setGroup = useNavStore((s) => s.setGroup)
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
  // Public screens a logged-out user may view without being bounced to sign-in.
  const isPublicScreen = isAuthScreen || screen === 'landing'

  // After Google OAuth the browser reloads fresh at the app origin with the nav
  // store defaulted to 'sign-in'. Once the session resolves, move an
  // authenticated user off the auth screens: to onboarding if they have no
  // profile yet (brand-new — Google never hits AuthPage.onAuthed); otherwise into
  // the app — an existing user with groups lands in their most recent group chat,
  // one with none sees empty-groups. The ref guards the async fetch from firing
  // more than once.
  const routedRef = useRef(false)
  // `forwarding`: the async forward (profile + groups fetch) is in flight — keep
  // the splash up so the landing page never shows behind it. `routed`: the
  // initial auth-forward has completed at least once; used (as render-safe state,
  // not the ref) to stop showing the splash if an authenticated user later
  // navigates back to a public screen on purpose.
  const [forwarding, setForwarding] = useState(false)
  const [routed, setRouted] = useState(false)
  useEffect(() => {
    if (USE_MOCK) return
    // Forward an authenticated user off any public screen (auth pages OR the
    // landing page, which is now the fresh-reload default) into the app.
    if (!session?.user || !isPublicScreen || routedRef.current) return
    routedRef.current = true
    setForwarding(true)
    void (async () => {
      try {
        const profile = await fetchProfile()
        if (!profile) {
          go('onboarding-1')
          return
        }
        await useGroupsStore.getState().load()
        const latest = mostRecentGroup(useGroupsStore.getState().groups)
        if (latest) {
          setGroup(latest.id)
          go('group-chat')
        } else {
          go('empty-groups')
        }
      } finally {
        setForwarding(false)
        setRouted(true)
      }
    })()
  }, [session, isPublicScreen, go, setGroup])

  // Splash gate (live mode only): show a branded loader — never the landing page —
  // while the session check is pending, OR while an authenticated user on a public
  // screen is being forwarded into the app. This closes the "landing flash before
  // auth resolves" gap for a signed-in user reloading. A logged-OUT user has no
  // session.user, so they fall through to the landing page after the brief pending
  // window.
  if (
    !USE_MOCK &&
    (isPending || (session?.user && isPublicScreen && !routed) || forwarding)
  ) {
    return <AppSplash />
  }

  // Auth guard (live mode only): every screen except the public pages (landing +
  // auth) requires a signed-in user. Wait for the initial session check before
  // bouncing.
  if (!USE_MOCK && !isPending && !user && !isPublicScreen) {
    return <AuthPage mode="signin" />
  }

  switch (screen) {
    case 'landing':
      return <LandingPage />
    case 'sign-in':
      return <AuthPage mode="signin" />
    case 'sign-up':
      return <AuthPage mode="signup" />
    case 'onboarding-1':
      return <Onboarding1 />
    case 'onboarding-2':
      return <OnboardingCuisines />
    case 'onboarding-3':
      return <Onboarding2 />
    case 'onboarding-4':
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
