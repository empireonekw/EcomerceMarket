import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Signed, short-lived tickets for the live-messaging socket (POST /api/messages/ticket issues one, server.js checks it
 * when the socket connects). Signed with AUTH_SECRET instead of kept in memory, so any worker can check a ticket
 * another worker issued (server.js runs several). Plain module, no Next.js imports: server.js loads it directly.
 *
 * ticket = base64url({ u: userId, r: rooms, e: expiresAt }) + "." + base64url(HMAC-SHA256)
 */
export const TICKET_TTL_MS = 60 * 1000;

const sign = (body) => createHmac('sha256', `socket-ticket:${process.env.AUTH_SECRET ?? ''}`).update(body).digest('base64url');

export function signSocketTicket(userId, rooms = []) {
  const body = Buffer.from(JSON.stringify({ u: String(userId), r: rooms, e: Date.now() + TICKET_TTL_MS })).toString('base64url');
  return `${body}.${sign(body)}`;
}

/** → { userId, rooms } for a genuine, unexpired ticket; otherwise null. */
export function verifySocketTicket(ticket) {
  if (typeof ticket !== 'string' || ticket.length > 2048 || !process.env.AUTH_SECRET) return null;
  const [body, mac] = ticket.split('.');
  if (!body || !mac) return null;
  const expected = Buffer.from(sign(body));
  const given = Buffer.from(mac);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const { u, r, e } = JSON.parse(Buffer.from(body, 'base64url').toString());
    if (typeof u !== 'string' || !Array.isArray(r) || !(e > Date.now())) return null;
    return { userId: u, rooms: r.filter((x) => typeof x === 'string') };
  } catch {
    return null;
  }
}
