import { getRequestUser } from '@/lib/auth';
import { json, unauthorized, errorResponse, tooMany } from '@/lib/api';
import { openSupportThread } from '@/lib/data/messages';

/** POST /api/messages/support — the user's chat with the Sellpify team (created if needed): { conversationId }. */
export async function POST(request) {
  const user = await getRequestUser(request);
  if (!user) return unauthorized();
  const slow = tooMany(`support-open:${user.id}`, 20, 60 * 60_000);
  if (slow) return slow;
  try {
    return json(await openSupportThread(user.id));
  } catch (err) {
    return errorResponse(err, 'POST /api/messages/support');
  }
}
