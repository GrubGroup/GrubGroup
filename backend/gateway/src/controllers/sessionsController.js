// Session/event request handlers.
import { prisma } from '../lib/prisma.js';
import {
  getRecommendations as fetchRecommendations,
  analyzeTurn as analyzeTurnAi,
} from '../services/aiClient.js';
import { geocode } from '../services/geocodeClient.js';

/** Parse a route param to a positive integer, or null when invalid. */
const toPositiveInt = (value) => {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
};

/** Broadcast a payload to a group's Socket.IO room (best-effort, never throws). */
const broadcastToGroup = (req, groupId, event, payload) => {
  if (groupId == null) return;
  try {
    const io = req.app.get('io');
    io?.to(`group:${groupId}`).emit(event, payload);
  } catch (err) {
    console.error(`socket broadcast ${event} failed`, err);
  }
};

/**
 * POST /api/sessions/:session_id/recommendations — proxy the group orchestrator.
 *
 * Delegates to the ai_service, which reconciles member preferences into a ranked
 * recommendation. On an ai_service error we pass its HTTP status through (e.g. 409
 * when not all members have confirmed, 502 on an upstream LLM/embedding failure)
 * rather than collapsing everything to a 500.
 *
 * Auth-guarded + member-scoped (see the route): only a session member may
 * trigger picks, since success WRITES a SESSION_BLOCK message into the group
 * chat and broadcasts it. On success the top picks are delivered INTO the group
 * chat: we persist a SESSION_BLOCK GroupMessage carrying the ranked items as JSON
 * (so it survives a reload via chat:history) and broadcast `session:picks` to the
 * group room. Both are best-effort — a chat-delivery hiccup never fails the call.
 */
const getRecommendations = async (req, res, next) => {
  const sessionId = toPositiveInt(req.params.session_id);
  if (!sessionId) {
    return res.status(400).json({ error: 'session_id must be a positive integer.' });
  }

  const forcePartial = req.body?.force_partial === true;

  try {
    // Membership guard: reject a caller who isn't part of this session before we
    // proxy (and before any group-chat write) — mirrors submitQa/analyzeTurn.
    const member = await prisma.sessionMember.findUnique({
      where: { session_id_user_id: { session_id: sessionId, user_id: req.user.id } },
    });
    if (!member) {
      return res.status(403).json({ error: 'Not a session member.' });
    }

    const recommendation = await fetchRecommendations(sessionId, { forcePartial });

    // Deliver the picks into the group chat (best-effort). Look up the session's
    // group + host so we can attribute the SESSION_BLOCK message and route the
    // broadcast to the right room.
    try {
      const session = await prisma.session.findUnique({
        where: { id: sessionId },
        select: { group_id: true, host_user_id: true },
      });
      if (session?.group_id != null) {
        // The block payload is the SAME shape whether delivered live (session:picks)
        // or reconstructed from chat:history (toWireMessage parses this JSON back
        // into `block`), so both paths render the identical picks card.
        const blockPayload = {
          kind: 'top_picks',
          session_id: sessionId,
          recommendation_id: recommendation.id,
          items: recommendation.items ?? [],
        };
        const block = await prisma.groupMessage.create({
          data: {
            group_id: session.group_id,
            user_id: session.host_user_id,
            content: JSON.stringify(blockPayload),
            message_type: 'SESSION_BLOCK',
          },
        });
        // Mirror the wire shape of a SESSION_BLOCK history message so the client
        // handles the live event and a reloaded message with one code path.
        broadcastToGroup(req, session.group_id, 'session:picks', {
          groupId: session.group_id,
          sessionId,
          messageId: String(block.id),
          userId: session.host_user_id,
          block: blockPayload,
          at: block.created_at.toISOString(),
        });
      }
    } catch (deliveryErr) {
      console.error('top-picks group-chat delivery failed', deliveryErr);
    }

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
 *
 * The host also answers the pre-session modal here: `occasion` (host-only event
 * label), `scheduled_for` (the chosen event time — an ISO string, or omitted /
 * "now" to stamp now()), `location_address` (the primary group location, which
 * we geocode to lat/lon), and `time_limit` (the answer window). occasion +
 * geocoded location are written to the HOST's Qa row so the orchestrator reads
 * them as the primary anchor; scheduled_for is stored on the Session and drives
 * the open/closed hard filter. On session:start the client emits the socket
 * event with the new session id.
 */
const createSession = async (req, res, next) => {
  const {
    group_id,
    time_limit,
    occasion,
    scheduled_for,
    location_address,
  } = req.body ?? {};

  if (!Number.isInteger(time_limit) || time_limit <= 0) {
    return res.status(400).json({ error: 'time_limit must be a positive integer.' });
  }
  if (group_id !== undefined && group_id !== null && !Number.isInteger(group_id)) {
    return res.status(400).json({ error: 'group_id must be an integer.' });
  }
  if (occasion !== undefined && occasion !== null && typeof occasion !== 'string') {
    return res.status(400).json({ error: 'occasion must be a string.' });
  }
  if (
    location_address !== undefined &&
    location_address !== null &&
    typeof location_address !== 'string'
  ) {
    return res.status(400).json({ error: 'location_address must be a string.' });
  }
  // scheduled_for: accept an ISO date string (custom time) or omit / "now"
  // (the host chose "Now") -> stamp the current time.
  let scheduledFor = new Date();
  if (
    scheduled_for !== undefined &&
    scheduled_for !== null &&
    scheduled_for !== 'now'
  ) {
    if (typeof scheduled_for !== 'string' || Number.isNaN(Date.parse(scheduled_for))) {
      return res.status(400).json({ error: 'scheduled_for must be an ISO date string or "now".' });
    }
    scheduledFor = new Date(scheduled_for);
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

    // Geocode the host's chosen location so the orchestrator has the primary
    // anchor coords. A miss/outage degrades to null coords (address text kept).
    // Done BEFORE the transaction (it's an external HTTP call) so the tx stays
    // short and never holds a DB lock across the network round-trip.
    const hasAddress =
      typeof location_address === 'string' && location_address.trim();
    const coords = hasAddress ? await geocode(location_address) : null;
    const seedHostQa = hasAddress || (typeof occasion === 'string' && occasion.trim());

    // Create the session (+ seeded members) and seed the HOST's Qa row with the
    // modal answers ATOMICALLY: occasion (host-only) + the geocoded primary
    // location. If the Qa seed fails, the session is rolled back rather than
    // orphaned. Members fill their own Qa rows via the sub-agent chat; the host's
    // row carries the event-level signals the pipeline reads as the primary anchor.
    const session = await prisma.$transaction(async (tx) => {
      const created = await tx.session.create({
        data: {
          host_user_id: req.user.id,
          group_id: group_id ?? null,
          time_limit,
          scheduled_for: scheduledFor,
          members: {
            create: memberIds.map((user_id) => ({ user_id })),
          },
        },
        include: { members: { select: { user_id: true, status: true } } },
      });

      if (seedHostQa) {
        const hostQaFields = {
          occasion: occasion ?? null,
          location_mode: hasAddress ? 'named' : null,
          location_address: location_address ?? null,
          location_lat: coords?.lat ?? null,
          location_lon: coords?.lon ?? null,
        };
        await tx.qa.upsert({
          where: {
            session_id_user_id: { session_id: created.id, user_id: req.user.id },
          },
          create: { session_id: created.id, user_id: req.user.id, ...hostQaFields },
          update: hostQaFields,
        });
      }

      return created;
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
 *
 * On success we broadcast `session:member_done` to the session's group room so
 * every client's live progress bar updates when a member finishes (the frontend
 * renders solely from this broadcast — no optimistic local flip). The payload
 * carries the fresh done/total counts so a late joiner or reload can reconcile.
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

    // Broadcast live progress to the group room. Load the session (for group_id)
    // + the fresh member counts in one go; best-effort so a socket hiccup never
    // fails the status write.
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      select: { group_id: true, members: { select: { user_id: true, status: true } } },
    });
    if (session?.group_id != null) {
      const total = session.members.length;
      const doneCount = session.members.filter((m) => m.status).length;
      broadcastToGroup(req, session.group_id, 'session:member_done', {
        groupId: session.group_id,
        sessionId,
        userId: req.user.id,
        status,
        doneCount,
        total,
        at: new Date().toISOString(),
      });
    }

    return res.status(200).json(member);
  } catch (err) {
    return next(err);
  }
};

/**
 * POST /api/sessions/:session_id/qa — submit this member's session preferences.
 *
 * Qa is one row per (session, member): this UPSERTS the caller's own row (their
 * temporary, session-scoped overrides — cuisines/budget/location). occasion
 * describes the shared EVENT and is HOST-ONLY: a non-host's value is silently
 * dropped and the response flags `host_only_ignored` so the client can tell the
 * user only the host sets it. The event TIME is no longer a Qa field — it lives
 * on Session.scheduled_for, set in the pre-session modal. 400 on invalid ranges,
 * 403 for non-members.
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
    location_address,
    location_lat,
    location_lon,
    radius_miles,
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
  if (
    location_address !== undefined &&
    location_address !== null &&
    typeof location_address !== 'string'
  ) {
    return res.status(400).json({ error: 'location_address must be a string.' });
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

    // occasion is the host's to set. For a non-host, drop it and flag it so the
    // client can explain why (silent drop, not a hard failure).
    const isHost = session.host_user_id === req.user.id;
    const hostOnlyIgnored =
      !isHost && occasion !== undefined && occasion !== null;
    const occasionValue = isHost ? (occasion ?? null) : null;

    // When a member supplies an address, geocode it server-side and let the
    // derived coordinates override any client-sent lat/lon (stored coords must
    // match the stored address; a geocode miss/outage yields null coords rather
    // than blocking the save). With no address (e.g. realtime device location),
    // the client-sent coordinates pass through unchanged.
    const hasAddress =
      typeof location_address === 'string' && location_address.trim();
    const coords = hasAddress ? await geocode(location_address) : null;
    const resolvedLat = hasAddress ? (coords?.lat ?? null) : (location_lat ?? null);
    const resolvedLon = hasAddress ? (coords?.lon ?? null) : (location_lon ?? null);

    // Shared fields for both create and update (per-member overrides).
    const fields = {
      preferred_cuisines: preferred_cuisines ?? [],
      disliked_cuisines: disliked_cuisines ?? [],
      occasion: occasionValue,
      location_mode: location_mode ?? null,
      location_address: location_address ?? null,
      location_lat: resolvedLat,
      location_lon: resolvedLon,
      radius_miles: radius_miles ?? null,
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
 * Format a Date into a short human-readable time-slot label for Event.time_slot
 * (a display string, e.g. "Fri, Jul 18, 7:00 PM"). Falls back to the ISO string.
 */
const formatTimeSlot = (dt) => {
  try {
    return dt.toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return dt.toISOString();
  }
};

/**
 * POST /api/sessions/:session_id/close — the HOST confirms the chosen restaurant,
 * closing the session and creating the durable Event. Host-only (403); 409 when
 * already closed; 400 on a bad restaurant_id.
 *
 * The Event's date/time/location are sourced from what the host set up front:
 * Event.date + Event.time_slot come from Session.scheduled_for, and Event.lat/lon
 * + address are snapshotted from the host's Qa row (the geocoded primary
 * location). `date` / `address` may still be supplied in the body to override,
 * but default to the session's own data so the frontend confirm only needs to
 * send { restaurant_id }. Snapshots occasion (host-only) and attaches all session
 * members as attendees, then deletes the transient Qa rows — all atomically.
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
  // date/address are OPTIONAL now (default to the session's scheduled_for + the
  // host's geocoded location). Validate only when explicitly supplied.
  if (date !== undefined && date !== null) {
    if (typeof date !== 'string' || Number.isNaN(Date.parse(date))) {
      return res.status(400).json({ error: 'date must be a valid date string.' });
    }
  }
  if (address !== undefined && address !== null && typeof address !== 'string') {
    return res.status(400).json({ error: 'address must be a string.' });
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

    // occasion + the geocoded primary location live on the HOST's Qa row (set in
    // the pre-session modal). Snapshot them onto the durable Event before the Qa
    // rows are deleted below. The event TIME comes from Session.scheduled_for.
    const hostQa = await prisma.qa.findUnique({
      where: {
        session_id_user_id: { session_id: sessionId, user_id: session.host_user_id },
      },
      select: {
        occasion: true,
        location_address: true,
        location_lat: true,
        location_lon: true,
      },
    });

    // Event date/time from the host's chosen scheduled_for (fall back to now if a
    // legacy session has none); Event.time_slot is its human-readable label.
    const eventDate = date
      ? new Date(date)
      : (session.scheduled_for ?? new Date());
    const eventAddress =
      (typeof address === 'string' && address.trim())
        ? address
        : (hostQa?.location_address ?? 'TBD');

    // Close the session, create the Event, and clear the session's Qa rows
    // atomically. Qa holds each member's TEMPORARY, session-scoped overrides;
    // once the event is created they've served their purpose and are deleted
    // (they never mutate the durable Profile — occasion, the geocoded location,
    // and the chosen time are all preserved on the Event above).
    const [closedSession, event] = await prisma.$transaction([
      prisma.session.update({
        where: { id: sessionId },
        data: { closed_at: new Date() },
      }),
      prisma.event.create({
        data: {
          date: eventDate,
          address: eventAddress,
          lat: hostQa?.location_lat ?? null,
          lon: hostQa?.location_lon ?? null,
          restaurant_id,
          restaurant_name: restaurant.name,
          occasion: hostQa?.occasion ?? null,
          time_slot: formatTimeSlot(eventDate),
          group_id: session.group_id ?? null,
          group_name: session.group?.name ?? null,
          attendees: {
            connect: session.members.map((m) => ({ id: m.user_id })),
          },
        },
      }),
      prisma.qa.deleteMany({ where: { session_id: sessionId } }),
    ]);

    // Announce the confirmed pick in the group chat (best-effort) so members see
    // the event was booked without polling.
    if (session.group_id != null) {
      broadcastToGroup(req, session.group_id, 'session:confirmed', {
        groupId: session.group_id,
        sessionId,
        event,
        at: closedSession.closed_at?.toISOString?.() ?? new Date().toISOString(),
      });
    }

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

/**
 * POST /api/sessions/:session_id/analyze — proxy one QA sub-agent turn.
 *
 * Forwards the caller's message to the ai_service conversational agent, which
 * parses it, reconciles against prior signals, and persists the caller's Qa row.
 * The gateway injects the caller's real user_id (never trust a client-supplied
 * one) and requires session membership (403). ai_service host-gates occasion by
 * session.host_user_id, so a non-host can't set event-level fields. Upstream
 * errors pass their status through (e.g. 502 on an LLM failure).
 */
const analyzeTurn = async (req, res, next) => {
  const sessionId = toPositiveInt(req.params.session_id);
  if (!sessionId) {
    return res.status(400).json({ error: 'session_id must be a positive integer.' });
  }

  const { message, message_source, conversation_history, current_signals } =
    req.body ?? {};
  if (typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ error: 'message is required.' });
  }

  try {
    // Membership guard (mirrors submitQa): only a session member may chat.
    const member = await prisma.sessionMember.findUnique({
      where: { session_id_user_id: { session_id: sessionId, user_id: req.user.id } },
    });
    if (!member) {
      return res.status(403).json({ error: 'Not a session member.' });
    }

    const result = await analyzeTurnAi(sessionId, {
      user_id: req.user.id, // server-verified identity, not client-supplied
      message,
      message_source: message_source ?? 'text',
      conversation_history: conversation_history ?? [],
      current_signals: current_signals ?? {},
    });
    return res.status(200).json(result);
  } catch (err) {
    if (err.response) {
      return res.status(err.response.status).json(err.response.data);
    }
    return next(err);
  }
};

/**
 * POST /api/geocode — validate + geocode a free-text address to coordinates.
 *
 * Used by the host pre-session modal to confirm a location resolves before
 * "Start session" proceeds. Returns { ok, lat, lon } on a hit, or { ok:false }
 * (200) when the address can't be resolved — the client treats a miss as an
 * inline "couldn't find that" hint, not an error. The Geocodio key stays
 * server-side (never exposed to the browser).
 */
const validateGeocode = async (req, res, next) => {
  const { address } = req.body ?? {};
  if (typeof address !== 'string' || !address.trim()) {
    return res.status(400).json({ error: 'address is required.' });
  }
  try {
    const coords = await geocode(address);
    if (!coords) {
      return res.status(200).json({ ok: false });
    }
    return res.status(200).json({ ok: true, lat: coords.lat, lon: coords.lon });
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
  analyzeTurn,
  validateGeocode,
};
