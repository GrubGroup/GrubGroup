// Socket handlers: group chat relay (join/leave + live message broadcast),
// backed by Postgres.
//
// Messages are PERSISTED to the GroupMessage table (Prisma) before being
// broadcast, so a server restart no longer clears history and late joiners
// (or page reloads) get the backlog. On join we replay recent history to the
// joining socket via 'chat:history'; each new 'chat:message' is written then
// echoed to the whole room. Typing presence and session:start remain
// ephemeral (never stored).
import { prisma } from '../lib/prisma.js';

// How many past messages to replay to a socket when it joins a room.
const HISTORY_LIMIT = 50;

/** Room name for a group's chat channel. */
const room = (groupId) => `group:${groupId}`;

/**
 * Shape a persisted GroupMessage row into the camelCase wire message the
 * frontend expects ({ id, groupId, userId, name, text, at }). `name` prefers
 * the author's stored display name / username, falling back to the socket's
 * cosmetic handshake label.
 * @param {{ id: number, group_id: number, user_id: number, content: string, created_at: Date, user?: { display_name?: string|null, username?: string|null } }} row
 * @param {string|null} [fallbackName]
 */
const toWireMessage = (row, fallbackName = null) => ({
  id: String(row.id),
  groupId: row.group_id,
  userId: row.user_id,
  name: row.user?.display_name ?? row.user?.username ?? fallbackName,
  text: row.content,
  at: row.created_at.toISOString(),
  // Tag SYSTEM rows (e.g. "X has left the group") so the client renders them as
  // a centered divider rather than a chat bubble. Everything else is text.
  type: row.message_type === 'SYSTEM' ? 'system' : 'text',
});

/**
 * True when `userId` belongs to `groupId`. Guards persistence + broadcast so we
 * never write a message for a non-member (mirrors the REST membership check in
 * groupsController.js).
 */
const isGroupMember = async (groupId, userId) => {
  if (!Number.isInteger(groupId) || !Number.isInteger(userId)) return false;
  const membership = await prisma.groupMember.findUnique({
    where: { group_id_user_id: { group_id: groupId, user_id: userId } },
  });
  return Boolean(membership);
};

/**
 * Wire the chat events for a single connected socket.
 * @param {import('socket.io').Server} io
 * @param {import('socket.io').Socket} socket
 */
const registerSessionHandlers = (io, socket) => {
  // The handshake (sockets/index.js) stores session.user.id as a STRING, but
  // GroupMessage.user_id is Int — coerce once so every write/guard uses the Int.
  const userId = Number(socket.data.userId);

  // Join a group's room, then replay recent history to THIS socket so a fresh
  // connection (reload / late joiner) sees the existing conversation.
  socket.on('group:join', async ({ groupId }) => {
    if (groupId == null) return;
    socket.join(room(groupId));

    try {
      if (!(await isGroupMember(groupId, userId))) return;
      const rows = await prisma.groupMessage.findMany({
        where: { group_id: groupId },
        orderBy: { id: 'desc' },
        take: HISTORY_LIMIT,
        include: { user: { select: { display_name: true, username: true } } },
      });
      // Query is newest-first for the LIMIT; send oldest-first for rendering.
      const messages = rows.reverse().map((row) => toWireMessage(row));
      socket.emit('chat:history', { groupId, messages });
    } catch (err) {
      // History is best-effort — a load failure must not drop the connection.
      console.error('group:join history load failed', err);
    }
  });

  socket.on('group:leave', ({ groupId }) => {
    if (groupId == null) return;
    socket.leave(room(groupId));
  });

  // A member sent a message. Persist it, then broadcast the stored row to the
  // WHOLE room including the sender, so every client renders from the same
  // canonical event (single source of truth — no dupes, no optimistic drift).
  socket.on('chat:message', async ({ groupId, text }) => {
    if (groupId == null) return;
    const trimmed = typeof text === 'string' ? text.trim() : '';
    if (!trimmed) return;

    try {
      if (!(await isGroupMember(groupId, userId))) return;
      const row = await prisma.groupMessage.create({
        data: { group_id: groupId, user_id: userId, content: trimmed },
        include: { user: { select: { display_name: true, username: true } } },
      });
      io.to(room(groupId)).emit('chat:message', toWireMessage(row, socket.data.name));
    } catch (err) {
      console.error('chat:message persist failed', err);
    }
  });

  // A member started a session. Broadcast to the whole room (incl. sender) so
  // every client shows the session card live, inline in their own chat.
  // Ephemeral — reconstructed from live session state, not replayed from history.
  socket.on('session:start', ({ groupId }) => {
    if (groupId == null) return;
    io.to(room(groupId)).emit('session:start', {
      groupId,
      startedBy: socket.data.userId ?? null,
      at: new Date().toISOString(),
    });
  });

  // Typing presence — ephemeral, never stored. Relay to OTHERS in the room
  // (socket.to excludes the sender) so you never see your own "typing…".
  const emitTyping = (groupId, isTyping) => {
    if (groupId == null) return;
    socket.to(room(groupId)).emit('typing:update', {
      groupId,
      userId: socket.data.userId ?? null,
      name: socket.data.name ?? null,
      isTyping,
    });
  };
  socket.on('typing:start', ({ groupId }) => emitTyping(groupId, true));
  socket.on('typing:stop', ({ groupId }) => emitTyping(groupId, false));
};

export { registerSessionHandlers };
