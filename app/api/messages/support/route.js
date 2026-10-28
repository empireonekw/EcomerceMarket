import { getRequestUser } from '@/lib/auth';
import { json, unauthorized, errorResponse } from '@/lib/api';
import { openSupportThread } from '@/lib/data/messages';

/** POST /api/messages/support — the user's chat with the Sellpify team (created if needed): { conversationId }. */
export async function POST(request) {
  const user = await getRequestUser(request);
  if (!user) return unauthorized();
  try {
    return json(await openSupportThread(user.id));
  } catch (err) {
    return errorResponse(err, 'POST /api/messages/support');
  }
}
