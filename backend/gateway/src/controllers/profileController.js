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
    default_address,
    default_lat,
    default_lon,
    default_radius,
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
  // Location is optional. When present, the address must be a string and the
  // coordinates / radius (if given) must be numbers.
  if (
    default_address !== undefined &&
    default_address !== null &&
    typeof default_address !== 'string'
  ) {
    return 'default_address must be a string.';
  }
  for (const [key, value] of Object.entries({ default_lat, default_lon, default_radius })) {
    if (value !== undefined && value !== null && typeof value !== 'number') {
      return `${key} must be a number.`;
    }
  }
  if (default_radius !== undefined && default_radius !== null && default_radius <= 0) {
    return 'default_radius must be a positive number of miles.';
  }
  return null;
};

// Normalize the persistable location fields from a request body. Absent keys
// stay undefined (so an upsert can omit them); explicit null clears them.
const locationFields = (body) => {
  const fields = {};
  if (body.default_address !== undefined) fields.default_address = body.default_address;
  if (body.default_lat !== undefined) fields.default_lat = body.default_lat;
  if (body.default_lon !== undefined) fields.default_lon = body.default_lon;
  if (body.default_radius !== undefined) fields.default_radius = body.default_radius;
  return fields;
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
        ...locationFields(req.body),
      },
    });
    return res.status(201).json(profile);
  } catch (err) {
    return next(err);
  }
};

/**
 * PUT /api/profile — upsert the caller's profile.
 * Creates the row on first save (onboarding) and updates it thereafter, so the
 * frontend has a single idempotent save path. Leaves liked_restaurant_ids
 * untouched on update — it is owned by the like/unlike endpoints.
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

  const lists = {
    dietary_restrictions: dietary_restrictions ?? [],
    disliked_cuisines: disliked_cuisines ?? [],
    preferred_cuisines: preferred_cuisines ?? [],
  };

  try {
    const profile = await prisma.profile.upsert({
      where: { user_id: req.user.id },
      update: {
        ...lists,
        budget_min,
        budget_max,
        ...locationFields(req.body),
      },
      create: {
        user_id: req.user.id,
        ...lists,
        budget_min,
        budget_max,
        liked_restaurant_ids: [],
        ...locationFields(req.body),
      },
    });
    return res.status(200).json(profile);
  } catch (err) {
    return next(err);
  }
};

export { getProfile, createProfile, updateProfile };
