import 'server-only';
import { randomBytes } from 'node:crypto';

/**
 * Live updates for the inbox over Socket.IO.
 *
 * server.js owns the Socket.IO server and puts it on globalThis.__io; it holds no app logic. Everything it needs
 * from the app (who a socket belongs to, who may see someone typing) comes from the hooks this module installs on
 * globalThis.__realtimeHooks, so authentication stays in lib/auth.js and the database code stays in lib/data.
 *
 * Every socket joins the room `user:<id>`; the app emits to people, never to conversations.
 * Without server.js (plain `next dev`, Vercel) there is no io: emits are no-ops and the client falls back to polling.
 */

const TICKET_TTL_MS = 60 * 1000;
const tickets = globalThis.__socketTickets ?? new Map(); // ticket → { userId, expiresAt }
globalThis.__socketTickets = tickets;

/** One-time, short-lived ticket a signed-in browser presents when its socket connects. */
export function issueSocketTicket(userId) {
  const now = Date.now();
  if (tickets.size > 5_000) for (const [t, v] of tickets) if (v.expiresAt <= now) tickets.delete(t);
  const ticket = randomBytes(24).toString('base64url');
  tickets.set(ticket, { userId: String(userId), expiresAt: now + TICKET_TTL_MS });
  return ticket;
}

function redeemTicket(ticket) {
  if (typeof ticket !== 'string') return null;
  const entry = tickets.get(ticket);
  tickets.delete(ticket);
  return entry && entry.expiresAt > Date.now() ? entry.userId : null;
}

/** Called by the messaging data layer once loaded; `peerOf(userId, conversationId)` → the other person's id or null. */
export function installRealtimeHooks({ peerOf }) {
  globalThis.__realtimeHooks = { authenticate: redeemTicket, peerOf };
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
