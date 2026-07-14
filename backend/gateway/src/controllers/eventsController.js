// Event request handlers: the caller's dining history.
import { prisma } from '../lib/prisma.js';

/**
 * GET /api/events — past outings the caller attended (Event.attendees M:N).
 * Newest-first; returns the flat event shape used across the app.
 */
const listEvents = async (req, res, next) => {
  try {
    const events = await prisma.event.findMany({
      where: { attendees: { some: { id: req.user.id } } },
      orderBy: { date: 'desc' },
      select: {
        id: true,
        date: true,
        address: true,
        restaurant_id: true,
        restaurant_name: true,
        occasion: true,
        time_slot: true,
        group_id: true,
        group_name: true,
      },
    });
    return res.status(200).json(events);
  } catch (err) {
    return next(err);
  }
};

export { listEvents };
