import axios from 'axios'
import { GATEWAY_URL } from './env'

// Single axios instance pointed at the gateway. The frontend talks ONLY to the
// gateway (never ai_service directly). Auth token is attached per-request from
// the auth store when present.
export const api = axios.create({
  baseURL: `${GATEWAY_URL}/api`,
  headers: { 'Content-Type': 'application/json' },
})

let authToken: string | null = null

export function setAuthToken(token: string | null) {
  authToken = token
}

api.interceptors.request.use((config) => {
  if (authToken) {
    config.headers.Authorization = `Bearer ${authToken}`
  }
  return config
})
