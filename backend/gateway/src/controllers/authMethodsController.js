// Public (pre-login) lookup: which auth providers an email is registered with.
// Lets the sign-in/up form nudge a Google-only email to "Continue with Google"
// instead of failing a password attempt on a Google-owned account.
import { prisma } from '../lib/prisma.js';

/**
 * GET /api/auth-methods?email=foo@bar.com
 * → 200 { google, password, exists } (booleans only — no names/ids leaked).
 * Unknown email → all false. Intentionally unauthenticated (used before login).
 */
const getAuthMethods = async (req, res, next) => {
  const raw = req.query.email;
  const email = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  if (!email) {
    return res.status(400).json({ error: 'email query parameter is required.' });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email },
      select: { accounts: { select: { providerId: true } } },
    });
    if (!user) {
      return res.status(200).json({ google: false, password: false, exists: false });
    }
    const providers = new Set(user.accounts.map((a) => a.providerId));
    return res.status(200).json({
      google: providers.has('google'),
      password: providers.has('credential'),
      exists: true,
    });
  } catch (err) {
    return next(err);
  }
};

export { getAuthMethods };
