import { useCallback, useEffect, useRef, useState } from 'react'
import { GOOGLE_CLIENT_ID } from '@/lib/env'

// Minimal typings for the Google Identity Services (GIS) global we use.
interface GoogleCredentialResponse {
  credential: string
}
interface GoogleIdApi {
  initialize: (config: {
    client_id: string
    callback: (res: GoogleCredentialResponse) => void
  }) => void
  prompt: (listener?: (notification: unknown) => void) => void
}
declare global {
  interface Window {
    google?: { accounts?: { id?: GoogleIdApi } }
  }
}

const GIS_SRC = 'https://accounts.google.com/gsi/client'

// Load the GIS script once, shared across hook instances.
let gisPromise: Promise<void> | null = null
function loadGis(): Promise<void> {
  if (gisPromise) return gisPromise
  gisPromise = new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) return resolve()
    const script = document.createElement('script')
    script.src = GIS_SRC
    script.async = true
    script.defer = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Failed to load Google Identity Services.'))
    document.head.appendChild(script)
  })
  return gisPromise
}

interface UseGoogleSignIn {
  onToken: (idToken: string) => void
  onError?: () => void
}

// Wraps GIS: initializes with our client ID and exposes signIn() to open the
// Google One Tap / account picker, delivering the ID token to onToken.
export function useGoogleSignIn({ onToken, onError }: UseGoogleSignIn) {
  const [ready, setReady] = useState(false)
  const onTokenRef = useRef(onToken)
  const onErrorRef = useRef(onError)

  // Keep callbacks fresh without re-running the GIS init effect below.
  useEffect(() => {
    onTokenRef.current = onToken
    onErrorRef.current = onError
  }, [onToken, onError])

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return
    let cancelled = false
    loadGis()
      .then(() => {
        if (cancelled) return
        window.google?.accounts?.id?.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: (res) => {
            if (res?.credential) onTokenRef.current(res.credential)
            else onErrorRef.current?.()
          },
        })
        setReady(true)
      })
      .catch(() => onErrorRef.current?.())
    return () => {
      cancelled = true
    }
  }, [])

  const signIn = useCallback(() => {
    if (!ready) {
      onErrorRef.current?.()
      return
    }
    window.google?.accounts?.id?.prompt()
  }, [ready])

  // `ready` is false when no client ID is configured — the button stays disabled.
  return { ready: ready && Boolean(GOOGLE_CLIENT_ID), signIn }
}
