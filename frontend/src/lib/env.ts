// Central runtime flags. `VITE_USE_MOCK` defaults to true so the app runs fully
// against mock data until the gateway/ai_service exist. Flip to 'false' to hit
// the real gateway — no component/store changes required.
export const USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false'

export const GATEWAY_URL = import.meta.env.VITE_GATEWAY_URL ?? 'http://localhost:4000'

// Google OAuth client ID for the "Continue with Google" button (Google Identity
// Services). Must match the gateway's GOOGLE_CLIENT_ID.
export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? ''
