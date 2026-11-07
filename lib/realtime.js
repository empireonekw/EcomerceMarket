import 'server-only';
import { signSocketTicket } from '@/lib/socket-ticket';

/**
 * Live updates for the inbox over Socket.IO.
 *
 * server.js owns the Socket.IO server and puts it on globalThis.__io; it holds no app logic. Everything it needs
 * from the app (who a socket belongs to, who may see someone typing) comes from the hooks this module installs on
 * globalThis.__realtimeHooks, so authentication stays in lib/auth.js and the database code stays in lib/data.
 *
 * Every socket joins the room `user:<id>` (admins also join `admins`); the app emits to people, never to conversations.
 * Without server.js (plain `next dev`, Vercel) there is no io: emits are no-ops and the client falls back to polling.
 */

/**
 * Short-lived ticket a signed-in browser presents when its socket connects. `rooms`: extra rooms to join. Signed, not
 * stored (lib/socket-ticket.js), because server.js runs several workers and the socket may land on another one.
 */
export const issueSocketTicket = (userId, rooms = []) => signSocketTicket(userId, rooms);

/** Called by the messaging data layer once loaded; `peerOf(userId, conversationId)` → the other person's id or null. */
export function installRealtimeHooks({ peerOf }) {
  globalThis.__realtimeHooks = { peerOf };
}

export const realtimeEnabled = () => Boolean(globalThis.__io);

/** Sends `event` to every open tab of each user. Never throws: a failed push must not fail the request. */
export function emitToUsers(userIds, event, payload) {
  const io = globalThis.__io;
  if (!io) return;
  try {
    for (const id of new Set(userIds.filter(Boolean).map(String))) io.to(`user:${id}`).emit(event, payload);
  } catch (err) {
    console.error('[realtime] emit failed', err);
  }
}

/** Sends `event` to a named room (e.g. 'admins'). Never throws. */
export function emitToRoom(room, event, payload) {
  try {
    globalThis.__io?.to(room).emit(event, payload);
  } catch (err) {
    console.error('[realtime] emit failed', err);
  }
}
