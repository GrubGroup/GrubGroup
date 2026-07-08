// Central runtime flags. `VITE_USE_MOCK` defaults to true so the app runs fully
// against mock data until the gateway/ai_service exist. Flip to 'false' to hit
// the real gateway — no component/store changes required.
export const USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false'

export const GATEWAY_URL = import.meta.env.VITE_GATEWAY_URL ?? 'http://localhost:3000'
