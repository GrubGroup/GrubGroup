// Auth request handlers: register / login / google.
//
// Each handler resolves a User via the auth service, mints a JWT, and returns
// { token, user } — the exact shape the frontend's authStore.login expects.
import * as authService from '../services/auth.service.js'
import { mintToken } from '../services/jwt.service.js'

// Strip sensitive columns before sending a user to the client.
function toPublicUser(user) {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
    display_name: user.display_name,
    avatar_url: user.avatar_url,
    created_at: user.created_at,
    updated_at: user.updated_at,
  }
}

export async function register(req, res, next) {
  try {
    const { email, password, displayName } = req.body ?? {}
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' })
    }
    const user = await authService.registerWithPassword({ email, password, displayName })
    res.status(201).json({ token: mintToken(user), user: toPublicUser(user) })
  } catch (err) {
    next(err)
  }
}

export async function login(req, res, next) {
  try {
    const { email, password } = req.body ?? {}
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' })
    }
    const user = await authService.loginWithPassword({ email, password })
    res.json({ token: mintToken(user), user: toPublicUser(user) })
  } catch (err) {
    next(err)
  }
}

export async function google(req, res, next) {
  try {
    const { idToken } = req.body ?? {}
    if (!idToken) {
      return res.status(400).json({ error: 'idToken is required.' })
    }
    const user = await authService.loginWithGoogle({ idToken })
    res.json({ token: mintToken(user), user: toPublicUser(user) })
  } catch (err) {
    next(err)
  }
}
