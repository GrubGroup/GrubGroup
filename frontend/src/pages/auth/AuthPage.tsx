import { Button, Input } from '@/components/ui'
import { BrandPanel } from '@/components/layout/BrandPanel'
import { useAuthStore } from '@/stores/authStore'
import { useNavStore } from '@/stores/navStore'
import { MOCK_USER } from '@/api/mock/profile.mock'

export interface AuthPageProps {
  mode: 'signin' | 'signup'
}

const GoogleMark = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
    <path fill="#4285F4" d="M22.5 12.2c0-.7-.1-1.4-.2-2H12v3.9h5.9a5 5 0 0 1-2.2 3.3v2.7h3.6c2.1-2 3.2-4.9 3.2-7.9Z" />
    <path fill="#34A853" d="M12 23c2.9 0 5.4-1 7.2-2.6l-3.6-2.7c-1 .7-2.3 1.1-3.6 1.1-2.8 0-5.1-1.9-6-4.4H2.3v2.8A11 11 0 0 0 12 23Z" />
    <path fill="#FBBC05" d="M6 14.3a6.6 6.6 0 0 1 0-4.2V7.3H2.3a11 11 0 0 0 0 9.9L6 14.3Z" />
    <path fill="#EA4335" d="M12 5.5c1.6 0 3 .5 4.1 1.6l3.1-3.1A11 11 0 0 0 2.3 7.3L6 10.1c.9-2.6 3.2-4.6 6-4.6Z" />
  </svg>
)

const AppleMark = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M16.4 12.8c0-2.3 1.9-3.4 2-3.5-1.1-1.6-2.8-1.8-3.4-1.8-1.4-.1-2.8.8-3.5.8-.7 0-1.9-.8-3-.8-1.6 0-3 .9-3.8 2.3-1.6 2.8-.4 7 1.2 9.3.8 1.1 1.7 2.4 2.9 2.3 1.2 0 1.6-.7 3-.7s1.8.7 3 .7 2-1 2.8-2.1c.9-1.3 1.2-2.5 1.3-2.6-.1 0-2.5-1-2.5-3.8ZM14.3 5.9c.6-.8 1-1.9.9-3-.9 0-2 .6-2.7 1.4-.6.7-1.1 1.8-.9 2.8 1 .1 2-.5 2.7-1.2Z" />
  </svg>
)

export function AuthPage({ mode }: AuthPageProps) {
  const go = useNavStore((s) => s.go)
  const loginAsGuest = useAuthStore((s) => s.loginAsGuest)
  const isSignup = mode === 'signup'

  const handleSubmit = () => {
    loginAsGuest(MOCK_USER.display_name ?? 'Dev Patel')
    // Sign in → group chats; Sign up → onboarding.
    go(isSignup ? 'onboarding-1' : 'empty-groups')
  }

  return (
    <div className="flex h-screen bg-surface-raised">
      <BrandPanel />

      <div className="flex flex-1 items-center justify-center p-8">
        <div className="flex w-full max-w-sm flex-col gap-5">
          <div>
            <h1 className="font-display text-3xl font-bold text-text">
              {isSignup ? 'Create your account' : 'Welcome back'}
            </h1>
            <p className="mt-1 text-sm text-text-muted">
              {isSignup
                ? 'Set your preferences once. Never repeat yourself.'
                : 'Sign in to your account to continue'}
            </p>
          </div>

          <div className="flex flex-col gap-2.5">
            <button className="flex h-11 w-full items-center justify-center gap-2 rounded-input border border-border bg-surface-raised text-sm font-medium text-text hover:bg-surface-sunken">
              <GoogleMark /> Continue with Google
            </button>
            <button className="flex h-11 w-full items-center justify-center gap-2 rounded-input bg-surface-inverse text-sm font-medium text-white hover:opacity-90">
              <AppleMark /> Continue with Apple
            </button>
          </div>

          <div className="flex items-center gap-3 text-xs text-text-muted">
            <span className="h-px flex-1 bg-border" />
            or
            <span className="h-px flex-1 bg-border" />
          </div>

          <div className="flex flex-col gap-3">
            {isSignup && <Input label="FULL NAME" placeholder="Dev Patel" />}
            <Input label="EMAIL" type="email" placeholder="you@example.com" />
            <div className="flex flex-col gap-1.5">
              {!isSignup && (
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-text">PASSWORD</span>
                  <button className="text-xs text-text-muted hover:text-text">
                    Forgot password?
                  </button>
                </div>
              )}
              <Input
                label={isSignup ? 'PASSWORD' : undefined}
                type="password"
                placeholder="••••••••"
              />
            </div>
          </div>

          <Button fullWidth variant="primary" onClick={handleSubmit}>
            {isSignup ? 'Create account' : 'Sign in'}
          </Button>

          {isSignup && (
            <p className="text-center text-xs text-text-muted">
              By signing up you agree to our Terms and Privacy Policy.
            </p>
          )}

          <p className="text-center text-sm text-text-muted">
            {isSignup ? 'Already have an account? ' : "Don't have an account? "}
            <button
              onClick={() => go(isSignup ? 'sign-in' : 'sign-up')}
              className="font-semibold text-text hover:text-primary"
            >
              {isSignup ? 'Sign in' : 'Sign up'}
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}
