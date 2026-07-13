// Session guard for protected routes (Better Auth cookie sessions).
import { fromNodeHeaders } from 'better-auth/node';
import { auth } from '../lib/auth.js';

/**
 * Require a valid Better Auth session. On success attaches
 * req.user = { id, role }; otherwise responds 401.
 */
const requireAuth = async (req, res, next) => {
  try {
    const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
    if (!session) {
      return res.status(401).json({ error: 'Not authenticated.' });
    }
    req.user = { id: session.user.id, role: session.user.role };
    next();
  } catch {
    return res.status(401).json({ error: 'Not authenticated.' });
  }
};

/**
 * Require the authenticated user to hold one of the given roles.
 * Use after requireAuth.
 * @param {...string} roles
 */
const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden.' });
    }
    next();
  };
};

export { requireAuth, requireRole };
