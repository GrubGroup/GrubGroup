// Socket handlers: group chat relay (join/leave + live message broadcast).
//
// Ephemeral only — messages are relayed in memory, never stored. A server
// restart clears everything and late joiners see an empty chat. Persistence
// (via ai_service → Postgres) is a documented follow-up, not in scope here.

// Monotonic message id source. Not persisted; only needs to be unique per run.
let messageSeq = 0
function nextMessageId() {
  return `m${Date.now().toString(36)}-${messageSeq++}`
}

const room = (groupId) => `group:${groupId}`

// Wire the chat events for a single connected socket.
export function registerSessionHandlers(io, socket) {
  // Join a group's room so this socket receives that group's messages.
  socket.on('group:join', ({ groupId }) => {
    if (groupId == null) return
    socket.join(room(groupId))
  })

  socket.on('group:leave', ({ groupId }) => {
    if (groupId == null) return
    socket.leave(room(groupId))
  })

  // A member sent a message. Build the canonical message on the server and
  // broadcast to the WHOLE room including the sender, so every client renders
  // from the same event (single source of truth — no dupes, no optimistic drift).
  socket.on('chat:message', ({ groupId, text }) => {
    if (groupId == null) return
    const trimmed = typeof text === 'string' ? text.trim() : ''
    if (!trimmed) return

    const msg = {
      id: nextMessageId(),
      groupId,
      // DEV ONLY: identity is taken from the handshake, unverified. Replace with
      // a JWT-authenticated user before any real deployment.
      userId: socket.data.userId ?? null,
      name: socket.data.name ?? null,
      text: trimmed,
      at: new Date().toISOString(),
    }

    io.to(room(groupId)).emit('chat:message', msg)
  })
}
