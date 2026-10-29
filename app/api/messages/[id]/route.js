import { getRequestUser } from '@/lib/auth';
import { json, unauthorized, readJson, errorResponse } from '@/lib/api';
import { rateLimit } from '@/lib/rate-limit';
import { getConversation, sendMessage } from '@/lib/data/messages';

/** GET /api/messages/:id?before=<messageId> — a thread (marks it read). */
export async function GET(request, { params }) {
  const user = await getRequestUser(request);
  if (!user) return unauthorized();
  try {
    const { id } = await params;
    return json(await getConversation(user.id, id, { before: request.nextUrl.searchParams.get('before') }));
  } catch (err) {
    return errorResponse(err, 'GET /api/messages/:id');
  }
}

/** POST /api/messages/:id — { body }: reply in a thread. */
export async function POST(request, { params }) {
  const user = await getRequestUser(request);
  if (!user) return unauthorized();
  if (!rateLimit(`msg-send:${user.id}`, { limit: 40, windowMs: 60 * 1000 }).ok) {
    return json({ error: 'Slow down a little. Try again in a minute.' }, 429);
  }
  try {
    const { id } = await params;
    const body = await readJson(request);
    return json(await sendMessage(user.id, id, body.body), 201);
  } catch (err) {
    return errorResponse(err, 'POST /api/messages/:id');
  }
}
