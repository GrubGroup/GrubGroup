import axios from 'axios'
import { GATEWAY_URL } from './env'

// Single axios instance pointed at the gateway. The frontend talks ONLY to the
// gateway (never ai_service directly). Auth is cookie-based (Better Auth), so
// requests carry the httpOnly session cookie via withCredentials — there's no
// bearer token to attach.
export const api = axios.create({
  // Empty GATEWAY_URL → same-origin `/api` (dev proxies to the gateway so the
  // session cookie is first-party).
  baseURL: `${GATEWAY_URL}/api`,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
})
