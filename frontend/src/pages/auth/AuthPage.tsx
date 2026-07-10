import { useState } from 'react'
import { Button, Input } from '@/components/ui'
import { BrandPanel } from '@/components/layout/BrandPanel'
import { useNavStore } from '@/stores/navStore'
import { signIn, signUp } from '@/lib/authClient'

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

export function AuthPage({ mode }: AuthPageProps) {
  const go = useNavStore((s) => s.go)
  const isSignup = mode === 'signup'

  const [fullName, setFullName] = useState('')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  // Sign-in accepts a username OR an email in one field.
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // After a successful email/password auth, route per mode. The session cookie
  // is already set; App's useSession picks up the user. (Google redirects away
  // and returns to the app, so it doesn't reach here.)
  const onAuthed = () => go(isSignup ? 'onboarding-1' : 'empty-groups')

  const handleSubmit = async () => {
    setError(null)
    setLoading(true)

    let authError
    if (isSignup) {
      if (!email || !password || !username) {
        setError('Username, email, and password are required.')
        setLoading(false)
        return
      }
      // Better Auth client methods resolve with { data, error } (no throw).
      ;({ error: authError } = await signUp.email({
        email,
        password,
        name: fullName,
        username,
      }))
    } else {
      if (!identifier || !password) {
        setError('Enter your username or email and password.')
        setLoading(false)
        return
      }
      // Detect which credential the user typed: an "@" means it's an email.
      ;({ error: authError } = identifier.includes('@')
        ? await signIn.email({ email: identifier, password })
        : await signIn.username({ username: identifier, password }))
    }

    setLoading(false)
    if (authError) {
      setError(authError.message ?? 'Something went wrong. Please try again.')
      return
    }
    onAuthed()
  }

  // Google: full server-side OAuth redirect. On return, App routes based on the
  // now-active session; callbackURL brings the browser back to the app.
  const handleGoogle = async () => {
    setError(null)
    const { error: authError } = await signIn.social({
      provider: 'google',
      callbackURL: window.location.origin,
    })
    if (authError) setError('Google sign-in failed. Please try again.')
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
            <button
              type="button"
              onClick={handleGoogle}
              disabled={loading}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-input border border-border bg-surface-raised text-sm font-medium text-text hover:bg-surface-sunken disabled:cursor-not-allowed disabled:opacity-50"
            >
              <GoogleMark /> Continue with Google
            </button>
          </div>

          <div className="flex items-center gap-3 text-xs text-text-muted">
            <span className="h-px flex-1 bg-border" />
            or
            <span className="h-px flex-1 bg-border" />
          </div>

          <div className="flex flex-col gap-3">
            {isSignup ? (
              <>
                <Input
                  label="FULL NAME"
                  placeholder="Dev Patel"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
                <Input
                  label="USERNAME"
                  placeholder="devpatel"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  hint="3–30 characters: letters, numbers, dots, underscores."
                />
                <Input
                  label="EMAIL"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </>
            ) : (
              <Input
                label="USERNAME OR EMAIL"
                placeholder="devpatel or you@example.com"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
              />
            )}
            <div className="flex flex-col gap-1.5">
              {!isSignup && (
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-text">PASSWORD</span>
                  <button type="button" className="text-xs text-text-muted hover:text-text">
                    Forgot password?
                  </button>
                </div>
              )}
              <Input
                label={isSignup ? 'PASSWORD' : undefined}
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSubmit()
                }}
              />
            </div>
          </div>

          {error && <p className="text-sm text-error">{error}</p>}

          <Button fullWidth variant="primary" onClick={handleSubmit} isLoading={loading}>
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
