// Profile request handlers: read, create, and update the caller's preference profile.
import { prisma } from '../lib/prisma.js';

/**
 * Validate the shared profile body. Returns an error message string when invalid,
 * or null when the body is acceptable.
 */
const validateProfileBody = (body) => {
  const {
    dietary_restrictions,
    disliked_cuisines,
    preferred_cuisines,
    budget_min,
    budget_max,
  } = body;

  if (typeof budget_min !== 'number' || typeof budget_max !== 'number') {
    return 'budget_min and budget_max are required numbers.';
  }
  if (budget_min > budget_max) {
    return 'Inverted budget: budget_min must be <= budget_max.';
  }
  for (const [key, value] of Object.entries({
    dietary_restrictions,
    disliked_cuisines,
    preferred_cuisines,
  })) {
    if (value !== undefined && !Array.isArray(value)) {
      return `${key} must be an array.`;
    }
  }
  return null;
};

/**
 * GET /api/profile — return the caller's preference profile.
 * 404 when the caller has not created one yet.
 */
const getProfile = async (req, res, next) => {
  try {
    const profile = await prisma.profile.findUnique({
      where: { user_id: req.user.id },
    });
    if (!profile) {
      return res.status(404).json({ error: 'No profile found.' });
    }
    return res.status(200).json(profile);
  } catch (err) {
    return next(err);
  }
};

/**
 * POST /api/profile — create the caller's profile.
 * 409 when a profile already exists (use PUT to update). Seeds an empty
 * liked_restaurant_ids list; likes are managed by the restaurant like endpoints.
 */
const createProfile = async (req, res, next) => {
  const message = validateProfileBody(req.body ?? {});
  if (message) {
    return res.status(400).json({ error: message });
  }

  const {
    dietary_restrictions,
    disliked_cuisines,
    preferred_cuisines,
    budget_min,
    budget_max,
  } = req.body;

  try {
    const existing = await prisma.profile.findUnique({
      where: { user_id: req.user.id },
    });
    if (existing) {
      return res.status(409).json({ error: 'Profile already exists.' });
    }

    const profile = await prisma.profile.create({
      data: {
        user_id: req.user.id,
        dietary_restrictions: dietary_restrictions ?? [],
        disliked_cuisines: disliked_cuisines ?? [],
        preferred_cuisines: preferred_cuisines ?? [],
        budget_min,
        budget_max,
        liked_restaurant_ids: [],
      },
    });
    return res.status(201).json(profile);
  } catch (err) {
    return next(err);
  }
};

/**
 * PUT /api/profile — update the caller's existing profile.
 * 404 when no profile exists yet (use POST to create). Leaves
 * liked_restaurant_ids untouched — it is owned by the like/unlike endpoints.
 */
const updateProfile = async (req, res, next) => {
  const message = validateProfileBody(req.body ?? {});
  if (message) {
    return res.status(400).json({ error: message });
  }

  const {
    dietary_restrictions,
    disliked_cuisines,
    preferred_cuisines,
    budget_min,
    budget_max,
  } = req.body;

  try {
    const existing = await prisma.profile.findUnique({
      where: { user_id: req.user.id },
    });
    if (!existing) {
      return res.status(404).json({ error: 'No profile found.' });
    }

    const profile = await prisma.profile.update({
      where: { user_id: req.user.id },
      data: {
        dietary_restrictions: dietary_restrictions ?? [],
        disliked_cuisines: disliked_cuisines ?? [],
        preferred_cuisines: preferred_cuisines ?? [],
        budget_min,
        budget_max,
      },
    });
    return res.status(200).json(profile);
  } catch (err) {
    return next(err);
  }
};

export { getProfile, createProfile, updateProfile };
