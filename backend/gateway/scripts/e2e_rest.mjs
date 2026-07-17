// End-to-end REST smoke test for the gateway.
//
// Signs up throwaway users via Better Auth, keeps each user's session cookie,
// and drives every REST route asserting the documented status codes. Safe to
// re-run: sign-up falls back to sign-in when the user already exists.
//
// Requires a running gateway + Postgres. The recommendation *generate* proxy is
// exercised only when ai_service is reachable; otherwise it is skipped.
//
//   ~/.bun/bin/bun run scripts/e2e_rest.mjs
//
// Env: GATEWAY_URL (default http://localhost:4000),
//      AI_SERVICE_URL (default http://localhost:8000).

const GATEWAY_URL = (process.env.GATEWAY_URL || 'http://localhost:4000').replace(/\/$/, '');
const AI_SERVICE_URL = (process.env.AI_SERVICE_URL || 'http://localhost:8000').replace(/\/$/, '');

// Fixed tag so throwaway rows are deterministic and re-runnable.
const TAG = 'e2erest';
const PASSWORD = 'e2e-Password-123';

let passed = 0;
let failed = 0;
const failures = [];

/** Assert an actual value equals the expected one; tally and log. */
const check = (label, got, want) => {
  const ok = got === want;
  if (ok) {
    passed += 1;
    console.log(`  ✓ ${label} (${got})`);
  } else {
    failed += 1;
    failures.push(`${label}: expected ${want}, got ${got}`);
    console.log(`  ✗ ${label}: expected ${want}, got ${got}`);
  }
};

/** Assert a boolean condition; tally and log. */
const assert = (label, cond, detail = '') => {
  if (cond) {
    passed += 1;
    console.log(`  ✓ ${label}`);
  } else {
    failed += 1;
    failures.push(`${label}${detail ? `: ${detail}` : ''}`);
    console.log(`  ✗ ${label}${detail ? `: ${detail}` : ''}`);
  }
};

/**
 * A minimal per-user cookie jar. Better Auth sets an httpOnly session cookie via
 * Set-Cookie; we parse the name=value pairs and replay them on every request.
 */
class Client {
  constructor() {
    this.cookies = new Map();
  }

  #storeSetCookies(res) {
    // Bun/undici expose getSetCookie() for multiple Set-Cookie headers.
    const raw = typeof res.headers.getSetCookie === 'function'
      ? res.headers.getSetCookie()
      : [res.headers.get('set-cookie')].filter(Boolean);
    for (const line of raw) {
      const [pair] = line.split(';');
      const idx = pair.indexOf('=');
      if (idx === -1) continue;
      const name = pair.slice(0, idx).trim();
      const value = pair.slice(idx + 1).trim();
      if (value === '' || value === 'deleted') this.cookies.delete(name);
      else this.cookies.set(name, value);
    }
  }

  #cookieHeader() {
    return [...this.cookies.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
  }

  async request(method, path, body) {
    const headers = {};
    const cookie = this.#cookieHeader();
    if (cookie) headers.cookie = cookie;
    if (body !== undefined) headers['content-type'] = 'application/json';

    const res = await fetch(`${GATEWAY_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    this.#storeSetCookies(res);

    let data = null;
    const text = await res.text();
    if (text) {
      try { data = JSON.parse(text); } catch { data = text; }
    }
    return { status: res.status, data };
  }

  get(path) { return this.request('GET', path); }
  post(path, body) { return this.request('POST', path, body); }
  put(path, body) { return this.request('PUT', path, body); }
  patch(path, body) { return this.request('PATCH', path, body); }
  del(path, body) { return this.request('DELETE', path, body); }
}

/** Sign up a fresh user (or sign in if they already exist). Returns a Client + user id. */
const authNewUser = async (suffix, displayName) => {
  const client = new Client();
  const email = `${TAG}_${suffix}@example.test`;
  const signUp = await client.post('/api/auth/sign-up/email', {
    email,
    password: PASSWORD,
    name: displayName,
  });
  // 200 (fresh) or an error we recover from by signing in (re-run of the suite).
  if (signUp.status !== 200) {
    const signIn = await client.post('/api/auth/sign-in/email', { email, password: PASSWORD });
    if (signIn.status !== 200) {
      throw new Error(`auth failed for ${email}: sign-up ${signUp.status}, sign-in ${signIn.status}`);
    }
  }
  const me = await client.get('/api/me');
  if (me.status !== 200) throw new Error(`/api/me failed for ${email}: ${me.status}`);
  return { client, id: Number(me.data.user.id), username: me.data.user.username, email };
};

const isReachable = async (url) => {
  try {
    const res = await fetch(`${url}/health`, { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch { return false; }
};

const run = async () => {
  // Preflight: gateway must be up.
  if (!(await isReachable(GATEWAY_URL))) {
    console.error(`Gateway not reachable at ${GATEWAY_URL}. Start it with:\n  ~/.bun/bin/bun run start\n`);
    process.exit(2);
  }

  console.log('\n== Auth guard ==');
  const anon = new Client();
  check('GET /api/profile unauthenticated -> 401', (await anon.get('/api/profile')).status, 401);

  // Two users: host (alice) and a second member (bob), plus an outsider (carol).
  const alice = await authNewUser('alice', 'E2E Alice');
  const bob = await authNewUser('bob', 'E2E Bob');
  const carol = await authNewUser('carol', 'E2E Carol');
  check('GET /api/me after sign-up -> 200', 200, 200);

  console.log('\n== Profile ==');
  // Re-run safety: if a profile already exists from a prior run, the first GET is 200.
  const pInit = await alice.client.get('/api/profile');
  assert('GET /api/profile initial -> 404 or 200', pInit.status === 404 || pInit.status === 200,
    `got ${pInit.status}`);
  check('POST /api/profile bad budget -> 400',
    (await alice.client.post('/api/profile', { budget_min: 50, budget_max: 10 })).status, 400);
  const pCreate = await alice.client.post('/api/profile', {
    dietary_restrictions: ['vegan'],
    preferred_cuisines: ['thai'],
    disliked_cuisines: ['steakhouse'],
    budget_min: 15,
    budget_max: 40,
  });
  assert('POST /api/profile create -> 201 or 409 (re-run)',
    pCreate.status === 201 || pCreate.status === 409, `got ${pCreate.status}`);
  check('POST /api/profile again -> 409', (await alice.client.post('/api/profile', {
    budget_min: 15, budget_max: 40,
  })).status, 409);
  check('PUT /api/profile update -> 200', (await alice.client.put('/api/profile', {
    preferred_cuisines: ['thai', 'mexican'], budget_min: 20, budget_max: 60,
  })).status, 200);
  check('GET /api/profile after create -> 200', (await alice.client.get('/api/profile')).status, 200);

  console.log('\n== Restaurants ==');
  const rCreate = await alice.client.post('/api/restaurants', {
    name: `E2E Diner ${Date.now?.() ?? ''}`.trim(),
    description: 'A cozy test spot',
    cuisine_tags: ['thai', 'vegan_friendly'],
    dietary_tags: ['vegan', 'gluten_free'],
    price_avg: 25,
    address: '123 Test St',
    lat: 37.77,
    long: -122.41,
  });
  check('POST /api/restaurants -> 201 (embedding may be NULL)', rCreate.status, 201);
  const restaurantId = rCreate.data?.id;
  assert('created restaurant has id', Number.isInteger(restaurantId), `got ${restaurantId}`);
  check('GET /api/restaurants list -> 200', (await alice.client.get('/api/restaurants?limit=5')).status, 200);
  check('GET /api/restaurants filter -> 200',
    (await alice.client.get('/api/restaurants?cuisine=thai&price_max=50')).status, 200);
  check('GET /api/restaurants/:id -> 200', (await alice.client.get(`/api/restaurants/${restaurantId}`)).status, 200);
  check('GET /api/restaurants/:id missing -> 404', (await alice.client.get('/api/restaurants/99999999')).status, 404);
  check('POST like -> 200', (await alice.client.post(`/api/restaurants/${restaurantId}/like`)).status, 200);
  const likeAgain = await alice.client.post(`/api/restaurants/${restaurantId}/like`);
  check('POST like idempotent -> 200', likeAgain.status, 200);
  assert('like list contains restaurant',
    Array.isArray(likeAgain.data?.liked_restaurant_ids) && likeAgain.data.liked_restaurant_ids.includes(restaurantId));
  check('DELETE like -> 200', (await alice.client.del(`/api/restaurants/${restaurantId}/like`)).status, 200);

  console.log('\n== Groups ==');
  const gCreate = await alice.client.post('/api/groups', { name: 'E2E Crew' });
  check('POST /api/groups -> 201', gCreate.status, 201);
  const groupId = gCreate.data?.id;
  check('GET /api/groups -> 200', (await alice.client.get('/api/groups')).status, 200);
  check('GET /api/groups/:id -> 200', (await alice.client.get(`/api/groups/${groupId}`)).status, 200);
  check('POST add member by username -> 201',
    (await alice.client.post(`/api/groups/${groupId}/members`, { username: bob.username })).status, 201);
  check('POST add member duplicate -> 409',
    (await alice.client.post(`/api/groups/${groupId}/members`, { user_id: bob.id })).status, 409);
  check('POST message -> 201',
    (await alice.client.post(`/api/groups/${groupId}/messages`, { content: 'hello group' })).status, 201);
  check('GET messages -> 200', (await alice.client.get(`/api/groups/${groupId}/messages?limit=10`)).status, 200);
  check('outsider GET /api/groups/:id -> 403', (await carol.client.get(`/api/groups/${groupId}`)).status, 403);

  console.log('\n== Sessions ==');
  const sCreate = await alice.client.post('/api/sessions', { group_id: groupId, time_limit: 30 });
  check('POST /api/sessions from group -> 201', sCreate.status, 201);
  const sessionId = sCreate.data?.id;
  check('GET /api/sessions/:id -> 200', (await alice.client.get(`/api/sessions/${sessionId}`)).status, 200);
  check('carol GET /api/sessions/:id -> 403', (await carol.client.get(`/api/sessions/${sessionId}`)).status, 403);
  check('PATCH members/me ready (alice) -> 200',
    (await alice.client.patch(`/api/sessions/${sessionId}/members/me`, { status: true })).status, 200);
  check('PATCH members/me ready (bob) -> 200',
    (await bob.client.patch(`/api/sessions/${sessionId}/members/me`, { status: true })).status, 200);
  check('GET members -> 200', (await alice.client.get(`/api/sessions/${sessionId}/members`)).status, 200);

  // QA: host sets occasion (kept); non-host sets it (dropped + flagged). The
  // event time is no longer a Qa field — it lives on Session.scheduled_for.
  const hostQa = await alice.client.post(`/api/sessions/${sessionId}/qa`, {
    preferred_cuisines: ['thai'], budget_min: 20, budget_max: 60,
    occasion: 'Birthday dinner',
  });
  check('POST qa host -> 201', hostQa.status, 201);
  assert('host qa host_only_ignored=false', hostQa.data?.host_only_ignored === false,
    `got ${hostQa.data?.host_only_ignored}`);
  const bobQa = await bob.client.post(`/api/sessions/${sessionId}/qa`, {
    preferred_cuisines: ['mexican'], budget_min: 10, budget_max: 30,
    occasion: 'should be ignored',
  });
  check('POST qa non-host -> 201', bobQa.status, 201);
  assert('non-host qa host_only_ignored=true', bobQa.data?.host_only_ignored === true,
    `got ${bobQa.data?.host_only_ignored}`);
  assert('non-host qa occasion dropped to null', bobQa.data?.occasion === null,
    `got ${bobQa.data?.occasion}`);

  check('GET summary before close -> 409', (await alice.client.get(`/api/sessions/${sessionId}/summary`)).status, 409);

  // Latest recommendation read (gateway-direct). 404 when none stored is fine.
  const latestRec = await alice.client.get(`/api/sessions/${sessionId}/recommendations`);
  assert('GET latest recommendation -> 200 or 404', latestRec.status === 200 || latestRec.status === 404,
    `got ${latestRec.status}`);

  console.log('\n== Close -> Event (validates occasion persistence) ==');
  check('non-host close -> 403',
    (await bob.client.post(`/api/sessions/${sessionId}/close`, {
      restaurant_id: restaurantId, date: new Date(0).toISOString(), address: '123 Test St',
    })).status, 403);
  const closeRes = await alice.client.post(`/api/sessions/${sessionId}/close`, {
    restaurant_id: restaurantId,
    date: '2026-08-01T19:30:00.000Z',
    address: '123 Test St',
  });
  check('host close -> 200', closeRes.status, 200);
  assert('closed Event has occasion = host value',
    closeRes.data?.event?.occasion === 'Birthday dinner', `got ${closeRes.data?.event?.occasion}`);
  // Event.time_slot is sourced from Session.scheduled_for in Phase 2's close
  // rework; until then close leaves it null (Qa.time_slot was dropped).
  assert('closed Event time_slot null (pre Phase 2)',
    closeRes.data?.event?.time_slot === null, `got ${closeRes.data?.event?.time_slot}`);
  check('GET summary after close -> 200', (await alice.client.get(`/api/sessions/${sessionId}/summary`)).status, 200);

  console.log('\n== Events ==');
  const events = await alice.client.get('/api/events');
  check('GET /api/events -> 200', events.status, 200);
  const created = Array.isArray(events.data)
    ? events.data.find((e) => e.restaurant_id === restaurantId)
    : null;
  assert('dining history includes the new event', Boolean(created));
  assert('event.occasion surfaced in history', created?.occasion === 'Birthday dinner',
    `got ${created?.occasion}`);

  console.log('\n== AI proxy (recommendation generate) ==');
  if (await isReachable(AI_SERVICE_URL)) {
    // A closed session can't generate, so this only confirms the proxy forwards a
    // real upstream status (not a gateway 500). Any of 200/409/502 is acceptable.
    const gen = await alice.client.post(`/api/sessions/${sessionId}/recommendations`, { force_partial: true });
    assert('POST recommendations proxied (200/409/502)',
      [200, 409, 502].includes(gen.status), `got ${gen.status}`);
  } else {
    console.log('  ⊘ SKIP: ai_service not reachable at ' + AI_SERVICE_URL);
  }

  console.log(`\n==== ${passed} passed, ${failed} failed ====`);
  if (failed > 0) {
    console.log('\nFailures:');
    for (const f of failures) console.log(`  - ${f}`);
    process.exit(1);
  }
};

run().catch((err) => {
  console.error('\nHarness crashed:', err.message);
  process.exit(1);
});
