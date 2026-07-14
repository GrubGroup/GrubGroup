// Session/event request handlers.
import { prisma } from '../lib/prisma.js';
import { getRecommendations as fetchRecommendations } from '../services/aiClient.js';

/** Parse a route param to a positive integer, or null when invalid. */
const toPositiveInt = (value) => {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
};

/**
 * POST /api/sessions/:session_id/recommendations — proxy the group orchestrator.
 *
 * Delegates to the ai_service, which reconciles member preferences into a ranked
 * recommendation. On an ai_service error we pass its HTTP status through (e.g. 409
 * when not all members have confirmed, 502 on an upstream LLM/embedding failure)
 * rather than collapsing everything to a 500.
 */
const getRecommendations = async (req, res, next) => {
  const sessionId = toPositiveInt(req.params.session_id);
  if (!sessionId) {
    return res.status(400).json({ error: 'session_id must be a positive integer.' });
  }

  const forcePartial = req.body?.force_partial === true;

  try {
    const recommendation = await fetchRecommendations(sessionId, { forcePartial });
    return res.status(200).json(recommendation);
  } catch (err) {
    if (err.response) {
      return res.status(err.response.status).json(err.response.data);
    }
    return next(err);
  }
};

/**
 * POST /api/sessions — start a session, optionally from a group.
 * When group_id is given the caller must be a member (403/404). The caller is
 * the host and is seeded as a member; group sessions seed all group members.
 */
const createSession = async (req, res, next) => {
  const { group_id, time_limit } = req.body ?? {};

  if (!Number.isInteger(time_limit) || time_limit <= 0) {
    return res.status(400).json({ error: 'time_limit must be a positive integer.' });
  }
  if (group_id !== undefined && group_id !== null && !Number.isInteger(group_id)) {
    return res.status(400).json({ error: 'group_id must be an integer.' });
  }

  try {
    // Seed members: always the host; for a group session, every group member.
    let memberIds = [req.user.id];

    if (group_id !== undefined && group_id !== null) {
      const group = await prisma.group.findUnique({
        where: { id: group_id },
        include: { members: { select: { user_id: true } } },
      });
      if (!group) {
        return res.status(404).json({ error: 'Group not found.' });
      }
      if (!group.members.some((m) => m.user_id === req.user.id)) {
        return res.status(403).json({ error: 'Not a group member.' });
      }
      memberIds = [...new Set([req.user.id, ...group.members.map((m) => m.user_id)])];
    }

    const session = await prisma.session.create({
      data: {
        host_user_id: req.user.id,
        group_id: group_id ?? null,
        time_limit,
        members: {
          create: memberIds.map((user_id) => ({ user_id })),
        },
      },
      include: { members: { select: { user_id: true, status: true } } },
    });
    return res.status(201).json(session);
  } catch (err) {
    return next(err);
  }
};

/**
 * GET /api/sessions/:session_id — session detail with members & readiness.
 * 403 for non-members, 404 when the session does not exist.
 */
const getSession = async (req, res, next) => {
  const sessionId = toPositiveInt(req.params.session_id);
  if (!sessionId) {
    return res.status(400).json({ error: 'session_id must be a positive integer.' });
  }

  try {
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        members: {
          select: {
            user_id: true,
            status: true,
            joined_at: true,
            user: { select: { display_name: true } },
          },
        },
      },
    });
    if (!session) {
      return res.status(404).json({ error: 'Session not found.' });
    }
    if (!session.members.some((m) => m.user_id === req.user.id)) {
      return res.status(403).json({ error: 'Not a session member.' });
    }

    const members = session.members.map(({ user, user_id, status, joined_at }) => ({
      user_id,
      display_name: user?.display_name ?? null,
      status,
      joined_at,
    }));
    return res.status(200).json({ ...session, members });
  } catch (err) {
    return next(err);
  }
};

/**
 * POST /api/sessions/:session_id/members — join a session (status=false).
 * 400 when the session is closed, 404 missing, 409 already joined.
 */
const joinSession = async (req, res, next) => {
  const sessionId = toPositiveInt(req.params.session_id);
  if (!sessionId) {
    return res.status(400).json({ error: 'session_id must be a positive integer.' });
  }

  try {
    const session = await prisma.session.findUnique({ where: { id: sessionId } });
    if (!session) {
      return res.status(404).json({ error: 'Session not found.' });
    }
    if (session.closed_at) {
      return res.status(400).json({ error: 'Session is closed.' });
    }

    const existing = await prisma.sessionMember.findUnique({
      where: { session_id_user_id: { session_id: sessionId, user_id: req.user.id } },
    });
    if (existing) {
      return res.status(409).json({ error: 'Already joined this session.' });
    }

    const member = await prisma.sessionMember.create({
      data: { session_id: sessionId, user_id: req.user.id },
    });
    return res.status(201).json(member);
  } catch (err) {
    return next(err);
  }
};

/**
 * GET /api/sessions/:session_id/members — members & readiness (poll).
 * 403 for non-members.
 */
const listMembers = async (req, res, next) => {
  const sessionId = toPositiveInt(req.params.session_id);
  if (!sessionId) {
    return res.status(400).json({ error: 'session_id must be a positive integer.' });
  }

  try {
    const members = await prisma.sessionMember.findMany({
      where: { session_id: sessionId },
      select: {
        user_id: true,
        status: true,
        joined_at: true,
        user: { select: { display_name: true } },
      },
      orderBy: { joined_at: 'asc' },
    });
    if (!members.some((m) => m.user_id === req.user.id)) {
      return res.status(403).json({ error: 'Not a session member.' });
    }

    const shaped = members.map(({ user, user_id, status, joined_at }) => ({
      user_id,
      display_name: user?.display_name ?? null,
      status,
      joined_at,
    }));
    return res.status(200).json(shaped);
  } catch (err) {
    return next(err);
  }
};

/**
 * PATCH /api/sessions/:session_id/members/me — set the caller's ready status.
 * 403/404 when the caller is not a member of the session.
 */
const setReady = async (req, res, next) => {
  const sessionId = toPositiveInt(req.params.session_id);
  if (!sessionId) {
    return res.status(400).json({ error: 'session_id must be a positive integer.' });
  }

  const { status } = req.body ?? {};
  if (typeof status !== 'boolean') {
    return res.status(400).json({ error: 'status must be a boolean.' });
  }

  try {
    const existing = await prisma.sessionMember.findUnique({
      where: { session_id_user_id: { session_id: sessionId, user_id: req.user.id } },
    });
    if (!existing) {
      return res.status(404).json({ error: 'Not a session member.' });
    }

    const member = await prisma.sessionMember.update({
      where: { session_id_user_id: { session_id: sessionId, user_id: req.user.id } },
      data: { status },
    });
    return res.status(200).json(member);
  } catch (err) {
    return next(err);
  }
};

/**
 * POST /api/sessions/:session_id/qa — submit this member's session preferences.
 *
 * Qa is one row per (session, member): this UPSERTS the caller's own row (their
 * temporary, session-scoped overrides — cuisines/budget/location). occasion and
 * time_slot describe the shared EVENT and are HOST-ONLY: a non-host's values are
 * silently dropped and the response flags `host_only_ignored` so the client can
 * tell the user only the host sets those. 400 on invalid ranges, 403 for
 * non-members.
 */
const submitQa = async (req, res, next) => {
  const sessionId = toPositiveInt(req.params.session_id);
  if (!sessionId) {
    return res.status(400).json({ error: 'session_id must be a positive integer.' });
  }

  const {
    preferred_cuisines,
    disliked_cuisines,
    occasion,
    location_mode,
    location_lat,
    location_lon,
    radius_miles,
    time_slot,
    budget_min,
    budget_max,
  } = req.body ?? {};

  if (
    budget_min !== undefined &&
    budget_max !== undefined &&
    budget_min !== null &&
    budget_max !== null &&
    budget_min > budget_max
  ) {
    return res.status(400).json({ error: 'Inverted budget: budget_min must be <= budget_max.' });
  }
  if (radius_miles !== undefined && radius_miles !== null && radius_miles < 0) {
    return res.status(400).json({ error: 'radius_miles must be non-negative.' });
  }

  try {
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      select: { host_user_id: true },
    });
    if (!session) {
      return res.status(404).json({ error: 'Session not found.' });
    }

    const member = await prisma.sessionMember.findUnique({
      where: { session_id_user_id: { session_id: sessionId, user_id: req.user.id } },
    });
    if (!member) {
      return res.status(403).json({ error: 'Not a session member.' });
    }

    // occasion + time_slot are the host's to set. For a non-host, drop them and
    // flag it so the client can explain why (silent drop, not a hard failure).
    const isHost = session.host_user_id === req.user.id;
    const hostOnlyIgnored =
      !isHost &&
      ((occasion !== undefined && occasion !== null) ||
        (time_slot !== undefined && time_slot !== null));
    const occasionValue = isHost ? (occasion ?? null) : null;
    const timeSlotValue = isHost ? (time_slot ?? null) : null;

    // Shared fields for both create and update (per-member overrides).
    const fields = {
      preferred_cuisines: preferred_cuisines ?? [],
      disliked_cuisines: disliked_cuisines ?? [],
      occasion: occasionValue,
      location_mode: location_mode ?? null,
      location_lat: location_lat ?? null,
      location_lon: location_lon ?? null,
      radius_miles: radius_miles ?? null,
      time_slot: timeSlotValue,
      budget_min: budget_min ?? null,
      budget_max: budget_max ?? null,
    };

    const qa = await prisma.qa.upsert({
      where: { session_id_user_id: { session_id: sessionId, user_id: req.user.id } },
      create: { session_id: sessionId, user_id: req.user.id, ...fields },
      update: fields,
    });
    return res.status(201).json({ ...qa, host_only_ignored: hostOnlyIgnored });
  } catch (err) {
    return next(err);
  }
};

/**
 * GET /api/sessions/:session_id/recommendations — fetch the latest stored
 * recommendation for the session (gateway-direct Prisma read). 404 when none.
 */
const getLatestRecommendation = async (req, res, next) => {
  const sessionId = toPositiveInt(req.params.session_id);
  if (!sessionId) {
    return res.status(400).json({ error: 'session_id must be a positive integer.' });
  }

  try {
    const recommendation = await prisma.recommendation.findFirst({
      where: { session_id: sessionId },
      orderBy: { created_at: 'desc' },
      include: {
        items: {
          select: {
            restaurant_id: true,
            match_score: true,
            justification: true,
            restaurant: { select: { name: true } },
          },
        },
      },
    });
    if (!recommendation) {
      return res.status(404).json({ error: 'No recommendation found.' });
    }

    const items = recommendation.items.map(({ restaurant, ...item }) => ({
      ...item,
      name: restaurant?.name ?? null,
    }));
    return res.status(200).json({ ...recommendation, items });
  } catch (err) {
    return next(err);
  }
};

/**
 * POST /api/sessions/:session_id/close — close a session and create an Event
 * from the chosen restaurant. Host-only (403); 409 when already closed.
 * Snapshots restaurant_name/group_name and attaches session members as attendees.
 */
const closeSession = async (req, res, next) => {
  const sessionId = toPositiveInt(req.params.session_id);
  if (!sessionId) {
    return res.status(400).json({ error: 'session_id must be a positive integer.' });
  }

  const { restaurant_id, date, address } = req.body ?? {};
  if (!Number.isInteger(restaurant_id) || restaurant_id <= 0) {
    return res.status(400).json({ error: 'restaurant_id must be a positive integer.' });
  }
  if (typeof date !== 'string' || Number.isNaN(Date.parse(date))) {
    return res.status(400).json({ error: 'date must be a valid date string.' });
  }
  if (typeof address !== 'string' || address.trim() === '') {
    return res.status(400).json({ error: 'address is required.' });
  }

  try {
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        group: { select: { name: true } },
        members: { select: { user_id: true } },
      },
    });
    if (!session) {
      return res.status(404).json({ error: 'Session not found.' });
    }
    if (session.host_user_id !== req.user.id) {
      return res.status(403).json({ error: 'Only the host can close the session.' });
    }
    if (session.closed_at) {
      return res.status(409).json({ error: 'Session is already closed.' });
    }

    const restaurant = await prisma.restaurant.findUnique({
      where: { id: restaurant_id },
      select: { name: true },
    });
    if (!restaurant) {
      return res.status(400).json({ error: 'restaurant_id does not exist.' });
    }

    // Close the session, create the Event, and clear the session's Qa rows
    // atomically. Qa holds each member's TEMPORARY, session-scoped overrides;
    // once the event is created they've served their purpose and are deleted
    // (they never mutate the durable Profile, so nothing is lost).
    const [closedSession, event] = await prisma.$transaction([
      prisma.session.update({
        where: { id: sessionId },
        data: { closed_at: new Date() },
      }),
      prisma.event.create({
        data: {
          date: new Date(date),
          address,
          restaurant_id,
          restaurant_name: restaurant.name,
          group_id: session.group_id ?? null,
          group_name: session.group?.name ?? null,
          attendees: {
            connect: session.members.map((m) => ({ id: m.user_id })),
          },
        },
      }),
      prisma.qa.deleteMany({ where: { session_id: sessionId } }),
    ]);
    return res.status(200).json({ session: closedSession, event });
  } catch (err) {
    return next(err);
  }
};

/**
 * GET /api/sessions/:session_id/summary — compact recap of a closed session.
 * 404 missing, 409 when the session is not yet closed.
 */
const getSessionSummary = async (req, res, next) => {
  const sessionId = toPositiveInt(req.params.session_id);
  if (!sessionId) {
    return res.status(400).json({ error: 'session_id must be a positive integer.' });
  }

  try {
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        members: { select: { user_id: true } },
      },
    });
    if (!session) {
      return res.status(404).json({ error: 'Session not found.' });
    }
    if (!session.members.some((m) => m.user_id === req.user.id)) {
      return res.status(403).json({ error: 'Not a session member.' });
    }
    if (!session.closed_at) {
      return res.status(409).json({ error: 'Session is not closed.' });
    }

    // The chosen restaurant lives on the Event created at close time. Match on
    // the group's most recent event when present; fall back to none.
    const event = session.group_id
      ? await prisma.event.findFirst({
          where: { group_id: session.group_id },
          orderBy: { id: 'desc' },
        })
      : null;

    // The latest recommendation carries the justification ("reason").
    const recommendation = await prisma.recommendation.findFirst({
      where: { session_id: sessionId },
      orderBy: { created_at: 'desc' },
      include: { items: { orderBy: { match_score: 'desc' }, take: 1 } },
    });

    return res.status(200).json({
      session_id: sessionId,
      closed_at: session.closed_at,
      chosen: event
        ? { restaurant_id: event.restaurant_id, name: event.restaurant_name }
        : null,
      attendees: session.members.map((m) => m.user_id),
      reason: recommendation?.items?.[0]?.justification ?? null,
    });
  } catch (err) {
    return next(err);
  }
};

export {
  getRecommendations,
  createSession,
  getSession,
  joinSession,
  listMembers,
  setReady,
  submitQa,
  getLatestRecommendation,
  closeSession,
  getSessionSummary,
};
