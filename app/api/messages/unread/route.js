import { getRequestUser } from '@/lib/auth';
import { json, unauthorized, errorResponse } from '@/lib/api';
import { countUnread } from '@/lib/data/messages';

/** GET /api/messages/unread — { count } for the inbox badge (polled only when the live socket is down). */
export async function GET(request) {
  const user = await getRequestUser(request);
  if (!user) return unauthorized();
  try {
    return json({ count: await countUnread(user.id) });
  } catch (err) {
    return errorResponse(err, 'GET /api/messages/unread');
  }
}
