// Restaurant request handlers: create-then-embed flow.
import { prisma } from '../services/prisma.js';
import { embed } from '../services/aiClient.js';
import { logger } from '../utils/logger.js';

const EMBEDDING_DIMS = 1024;

/**
 * Build the text we embed from a restaurant's descriptive fields.
 * @param {{ name?: string, description?: string, cuisine_tags?: string[] }} r
 */
function buildEmbedText(r) {
  return [r.name, r.description, (r.cuisine_tags ?? []).join(', ')]
    .filter(Boolean)
    .join('. ');
}

/**
 * Persist a restaurant's embedding via raw SQL. Prisma can't write the
 * Unsupported("vector(1024)") column through its typed API, so we cast a
 * vector literal string with ::vector. The literal and id are bound params.
 * @param {number} id
 * @param {number[]} embedding
 */
async function storeEmbedding(id, embedding) {
  if (!Array.isArray(embedding) || embedding.length !== EMBEDDING_DIMS) {
    throw new Error(
      `Expected ${EMBEDDING_DIMS}-dim embedding, got ${embedding?.length}`,
    );
  }
  const literal = `[${embedding.join(',')}]`;
  await prisma.$executeRaw`
    UPDATE "Restaurant" SET embedding = ${literal}::vector WHERE id = ${id}
  `;
}

/**
 * POST /api/restaurants — create a restaurant, then synchronously embed it.
 *
 * The row is created first so it owns the id we update. Because embedding is
 * nullable, a failed embed leaves a valid (not-yet-searchable) restaurant
 * rather than losing the whole creation — we return 201 either way.
 */
export async function createRestaurant(req, res, next) {
  const {
    name,
    description,
    cuisine_tags,
    dietary_tags,
    price_avg,
    address,
    lat,
    long,
    hours,
    avg_rating,
  } = req.body ?? {};

  if (!name) {
    return res.status(400).json({ error: 'name is required' });
  }

  let restaurant;
  try {
    // 1. Create the row (embedding stays NULL for now).
    restaurant = await prisma.restaurant.create({
      data: {
        name,
        description: description ?? null,
        cuisine_tags: cuisine_tags ?? [],
        dietary_tags: dietary_tags ?? [],
        price_avg: price_avg ?? null,
        address: address ?? null,
        lat: lat ?? null,
        long: long ?? null,
        hours: hours ?? null,
        avg_rating: avg_rating ?? null,
      },
    });
  } catch (err) {
    return next(err);
  }

  // 2-3. Generate + persist the embedding. On failure, log and continue —
  // the restaurant exists with embedding=NULL and can be backfilled later.
  try {
    const embedding = await embed(buildEmbedText(restaurant));
    await storeEmbedding(restaurant.id, embedding);
  } catch (err) {
    logger.error(
      `Embedding failed for restaurant ${restaurant.id}; stored with NULL embedding.`,
      err.message,
    );
  }

  // 4. Return the created restaurant. Re-read is unnecessary — the embedding
  // column isn't exposed through Prisma's typed client anyway.
  return res.status(201).json(restaurant);
}
