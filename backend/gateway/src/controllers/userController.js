// User request handlers: read and update the caller's own account identity
// (display_name, username). Auth credentials (email/password) are owned by
// Better Auth and are NOT edited here.
import { prisma } from '../lib/prisma.js';

// Better Auth's username plugin permits letters, numbers, dot, underscore.
// Mirror that here so gateway edits can't create usernames sign-in would reject.
const USERNAME_RE = /^[a-zA-Z0-9._]{3,30}$/;

/**
 * GET /api/user/me — return the caller's own User record (identity fields the
 * profile header shows: username, email, display_name, avatar_url, role).
 */
const getMe = async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        username: true,
        email: true,
        display_name: true,
        avatar_url: true,
        role: true,
        created_at: true,
        updated_at: true,
      },
    });
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }
    return res.status(200).json(user);
  } catch (err) {
    return next(err);
  }
};

/**
 * PATCH /api/user — update the caller's display_name and/or username.
 * Enforces username uniqueness with a pre-check (returns 409) and falls back to
 * catching a P2002 unique-constraint violation in case of a race.
 */
const updateMe = async (req, res, next) => {
  const body = req.body ?? {};
  const data = {};

  if (body.display_name !== undefined) {
    if (body.display_name !== null && typeof body.display_name !== 'string') {
      return res.status(400).json({ error: 'display_name must be a string.' });
    }
    data.display_name = body.display_name;
  }

  if (body.username !== undefined) {
    if (typeof body.username !== 'string' || !USERNAME_RE.test(body.username)) {
      return res.status(400).json({
        error: 'Username must be 3–30 characters: letters, numbers, dots, underscores.',
      });
    }
    data.username = body.username;
  }

  if (Object.keys(data).length === 0) {
    return res.status(400).json({ error: 'Nothing to update.' });
  }

  try {
    // Pre-check uniqueness: a taken username belonging to a different user is a
    // conflict. (Matches the pre-check pattern used elsewhere in the gateway.)
    if (data.username) {
      const owner = await prisma.user.findUnique({
        where: { username: data.username },
      });
      if (owner && owner.id !== req.user.id) {
        return res.status(409).json({ error: 'Username already taken.' });
      }
    }

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data,
      select: {
        id: true,
        username: true,
        email: true,
        display_name: true,
        avatar_url: true,
        role: true,
        created_at: true,
        updated_at: true,
      },
    });
    return res.status(200).json(user);
  } catch (err) {
    // Race fallback: unique-constraint violation slipped past the pre-check.
    if (err?.code === 'P2002') {
      return res.status(409).json({ error: 'Username already taken.' });
    }
    return next(err);
  }
};

export { getMe, updateMe };
