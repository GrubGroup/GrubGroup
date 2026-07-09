// Auth business logic: password + Google account creation and verification.
//
// Reads/writes the domain User table via Prisma (the one place the gateway
// touches the DB directly — see lib/prisma.js). Every function returns a User
// row; the controller mints the JWT.
import bcrypt from 'bcryptjs'
import { OAuth2Client } from 'google-auth-library'
import { prisma } from '../lib/prisma.js'
import { config } from '../config/index.js'

const BCRYPT_ROUNDS = 10
const googleClient = new OAuth2Client(config.GOOGLE_CLIENT_ID)

// Typed error so the controller can map to the right HTTP status.
export class AuthError extends Error {
  constructor(status, message) {
    super(message)
    this.name = 'AuthError'
    this.status = status
  }
}

// Derive a unique, valid username from an email, appending a numeric suffix on
// collision (User.username is NOT NULL + unique).
async function uniqueUsernameFromEmail(email) {
  const base = (email.split('@')[0] || 'user').toLowerCase().replace(/[^a-z0-9_]/g, '') || 'user'
  let candidate = base
  let n = 1
  // Loop until we find an unused username. Bounded in practice by collisions.
  while (await prisma.user.findUnique({ where: { username: candidate } })) {
    candidate = `${base}${n++}`
  }
  return candidate
}

// Create a new password-based account. Rejects if the email is already taken.
export async function registerWithPassword({ email, password, displayName }) {
  const normalizedEmail = email.trim().toLowerCase()
  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } })
  if (existing) {
    throw new AuthError(409, 'An account with this email already exists.')
  }

  const password_hash = await bcrypt.hash(password, BCRYPT_ROUNDS)
  return prisma.user.create({
    data: {
      email: normalizedEmail,
      username: await uniqueUsernameFromEmail(normalizedEmail),
      display_name: displayName?.trim() || null,
      password_hash,
      role: 'USER',
    },
  })
}

// Verify email + password. Rejects unknown emails, Google-only accounts (no
// password_hash), and wrong passwords with the same generic 401 message.
export async function loginWithPassword({ email, password }) {
  const normalizedEmail = email.trim().toLowerCase()
  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } })
  if (!user || !user.password_hash) {
    throw new AuthError(401, 'Invalid email or password.')
  }

  const ok = await bcrypt.compare(password, user.password_hash)
  if (!ok) {
    throw new AuthError(401, 'Invalid email or password.')
  }
  return user
}

// Verify a Google ID token and resolve to a User: match by google_id, else link
// to an existing account by verified email, else create a new Google account.
export async function loginWithGoogle({ idToken }) {
  if (!config.GOOGLE_CLIENT_ID) {
    throw new AuthError(500, 'Google sign-in is not configured.')
  }

  let payload
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: config.GOOGLE_CLIENT_ID,
    })
    payload = ticket.getPayload()
  } catch {
    throw new AuthError(401, 'Invalid Google credential.')
  }

  const googleId = payload?.sub
  const email = payload?.email?.toLowerCase()
  if (!googleId || !email || !payload?.email_verified) {
    throw new AuthError(401, 'Google account email is not verified.')
  }

  // 1) Already linked by google_id.
  const byGoogle = await prisma.user.findUnique({ where: { google_id: googleId } })
  if (byGoogle) return byGoogle

  // 2) Existing account with the same (verified) email — link it.
  const byEmail = await prisma.user.findUnique({ where: { email } })
  if (byEmail) {
    return prisma.user.update({
      where: { id: byEmail.id },
      data: { google_id: googleId },
    })
  }

  // 3) Brand-new Google account (no password).
  return prisma.user.create({
    data: {
      email,
      username: await uniqueUsernameFromEmail(email),
      display_name: payload?.name || null,
      avatar_url: payload?.picture || null,
      google_id: googleId,
      role: 'USER',
    },
  })
}
