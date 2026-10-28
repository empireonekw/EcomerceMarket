import { getRequestUser } from '@/lib/auth';
import { json, unauthorized } from '@/lib/api';
import { rateLimit } from '@/lib/rate-limit';
import { realtimeEnabled } from '@/lib/realtime';
import { createSocketTicket } from '@/lib/data/messages';

/**
 * POST /api/messages/ticket — a one-time ticket the browser hands to the Socket.IO server (server.js) to prove who
 * it is. { live: false } when the app runs without server.js (e.g. Vercel): the inbox then polls instead.
 */
export async function POST(request) {
  const user = await getRequestUser(request);
  if (!user) return unauthorized();
  if (!realtimeEnabled()) return json({ live: false });
  if (!rateLimit(`socket-ticket:${user.id}`, { limit: 30, windowMs: 60 * 1000 }).ok) return json({ error: 'Too many requests.' }, 429);
  return json({ live: true, ticket: createSocketTicket(user.id), userId: user.id });
}
