// JWT verification guard for protected routes.
import { verifyToken } from '../services/jwt.service.js'

// Require a valid Bearer JWT. On success attaches req.user = { id, role }.
export function requireAuth(req, res, next) {
  const header = req.headers.authorization || ''
  const [scheme, token] = header.split(' ')
  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Missing or malformed Authorization header.' })
  }

  try {
    const claims = verifyToken(token)
    req.user = { id: claims.userId, role: claims.role }
    next()
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token.' })
  }
}

// Require the authenticated user to hold one of the given roles. Use after
// requireAuth.
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden.' })
    }
    next()
  }
}
