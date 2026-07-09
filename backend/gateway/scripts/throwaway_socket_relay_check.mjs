// THROWAWAY verification harness — NOT part of the app, safe to delete.
// Proves the gateway Socket.IO relay works for two simulated members.
//
// Run (gateway must be listening on :4000):
//   bun backend/gateway/scripts/throwaway_socket_relay_check.mjs
//
// socket.io-client isn't a gateway dependency; we borrow the copy the frontend
// already installed (v4.8.x, protocol-compatible with the gateway's socket.io).
// If that path moves, update FRONTEND_CLIENT below.

const FRONTEND_CLIENT =
  '/Users/d.lam/Downloads/codepath/GrubGroup/frontend/node_modules/socket.io-client/build/cjs/index.js';
const { io } = await import(FRONTEND_CLIENT);

const URL = process.env.GATEWAY_URL ?? 'http://localhost:4000';
const GROUP_ID = 999; // arbitrary throwaway room
const TIMEOUT_MS = 8000;

let failures = 0;
const log = (ok, msg) => {
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}`);
};

function connect(userId, name) {
  const socket = io(URL, { auth: { userId, name }, transports: ['websocket', 'polling'] });
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`connect timeout for user ${userId}`)), TIMEOUT_MS);
    socket.on('connect', () => {
      clearTimeout(t);
      resolve(socket);
    });
    socket.on('connect_error', (e) => {
      clearTimeout(t);
      reject(new Error(`connect_error for user ${userId}: ${e.message}`));
    });
  });
}

// Collect the next event of a given name (or null on timeout).
function nextEvent(socket, event, ms = 3000) {
  return new Promise((resolve) => {
    const t = setTimeout(() => resolve(null), ms);
    socket.once(event, (payload) => {
      clearTimeout(t);
      resolve(payload);
    });
  });
}

const main = async () => {
  console.log(`Connecting two clients to ${URL} ...`);
  const a = await connect(1, 'Dev'); // as=1
  const b = await connect(2, 'Sofia'); // as=2
  log(true, 'both clients connected');

  a.emit('group:join', { groupId: GROUP_ID });
  b.emit('group:join', { groupId: GROUP_ID });
  await new Promise((r) => setTimeout(r, 300)); // let joins settle

  // --- chat:message relay: A sends, assert BOTH B (other) and A (sender) receive ---
  const bGetsMsg = nextEvent(b, 'chat:message');
  const aGetsMsg = nextEvent(a, 'chat:message');
  a.emit('chat:message', { groupId: GROUP_ID, text: '  hello group  ' });

  const bMsg = await bGetsMsg;
  const aMsg = await aGetsMsg;

  log(bMsg != null, 'other client (as=2) received chat:message');
  log(aMsg != null, 'sender (as=1) also received chat:message (io.to includes sender)');

  if (bMsg) {
    const shapeOk =
      typeof bMsg.id === 'string' &&
      bMsg.groupId === GROUP_ID &&
      bMsg.userId === 1 &&
      bMsg.name === 'Dev' &&
      bMsg.text === 'hello group' && // server trims
      typeof bMsg.at === 'string' &&
      !Number.isNaN(Date.parse(bMsg.at));
    log(shapeOk, `message shape correct: ${JSON.stringify(bMsg)}`);
  }

  // --- typing:update: A starts typing, assert B receives but A does NOT (socket.to excludes sender) ---
  const bGetsTyping = nextEvent(b, 'typing:update');
  const aGetsTyping = nextEvent(a, 'typing:update', 1500);
  a.emit('typing:start', { groupId: GROUP_ID });

  const bTyping = await bGetsTyping;
  const aTyping = await aGetsTyping;

  log(
    bTyping != null && bTyping.isTyping === true && bTyping.userId === 1,
    `other client (as=2) received typing:update: ${JSON.stringify(bTyping)}`,
  );
  log(aTyping === null, 'sender (as=1) did NOT receive own typing:update (socket.to excludes sender)');

  a.disconnect();
  b.disconnect();

  console.log(`\n${failures === 0 ? 'ALL PASS' : `${failures} FAILURE(S)`}`);
  process.exit(failures === 0 ? 0 : 1);
};

main().catch((e) => {
  console.error('HARNESS ERROR:', e.message);
  process.exit(2);
});
