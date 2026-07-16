// HTTP client turning a free-text address into coordinates via the Geocodio API.
import axios from 'axios';
import { config } from '../config/index.js';

const client = axios.create({
  // Geocodio v2 forward-geocoding. The version prefix is required.
  baseURL: 'https://api.geocod.io/v2',
  // Geocoding sits on the user's synchronous create/save path, so fail fast:
  // an unreachable Geocodio should degrade to null coords in a few seconds, not
  // hang the request behind a long timeout.
  timeout: 4_000,
});

/**
 * Geocode a free-text address to coordinates.
 *
 * Degrades gracefully to null (never throws) so a save is never blocked by a
 * missing key, a bad address, or a Geocodio outage — callers persist the
 * address text and leave lat/lon null in that case.
 *
 * @param {string} address a free-text address (e.g. "1109 N Highland St, Arlington VA")
 * @returns {Promise<{ lat: number, lon: number } | null>} coordinates, or null
 */
const geocode = async (address) => {
  if (!config.geocodioApiKey) return null;
  if (typeof address !== 'string' || !address.trim()) return null;

  try {
    const { data } = await client.get('/geocode', {
      // Let axios encode the query — addresses contain spaces and commas.
      params: { q: address, api_key: config.geocodioApiKey },
    });
    // Results are ordered most-accurate-first; an unmatched address returns a
    // 200 with an empty results array, so guard before reading location.
    const result = data?.results?.[0];
    if (!result?.location) return null;
    // Geocodio returns longitude as `lng`; the rest of the app uses `lon`.
    return { lat: result.location.lat, lon: result.location.lng };
  } catch {
    return null;
  }
};

export { geocode };
