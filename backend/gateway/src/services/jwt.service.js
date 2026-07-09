// Mint/verify JWT helpers.
//
// The gateway is the sole minter of JWTs (HS256). ai_service verifies them with
// the identical JWT_SECRET. Claim shape must match the frontend's JwtClaims
// (frontend/src/lib/jwt.ts): { sub, userId, role, exp }.
import jwt from 'jsonwebtoken'
import { config } from '../config/index.js'

// Build a signed token for an authenticated user row.
export function mintToken(user) {
  return jwt.sign(
    {
      sub: String(user.id),
      userId: user.id,
      role: user.role,
    },
    config.JWT_SECRET,
    { algorithm: 'HS256', expiresIn: config.JWT_EXPIRES_IN }
  )
}

// Verify and decode a token. Throws (JsonWebTokenError / TokenExpiredError) on
// any invalid or expired token — callers translate that into a 401.
export function verifyToken(token) {
  return jwt.verify(token, config.JWT_SECRET, { algorithms: ['HS256'] })
}
