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
    // Better Auth serializes the user id as a string; the domain schema uses
    // Int PKs, so coerce it once here and every controller can use it directly
    // in Prisma `where` clauses.
    req.user = { id: Number(session.user.id), role: session.user.role };
    next();
  } catch {
    return res.status(401).json({ error: 'Not authenticated.' });
  }
};

export { requireAuth };
