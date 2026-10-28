import { getRequestUser } from '@/lib/auth';
import { json, unauthorized, readJson, errorResponse } from '@/lib/api';
import { rateLimit } from '@/lib/rate-limit';
import { applyConversationAction, listConversations, startConversation } from '@/lib/data/messages';

/** GET /api/messages?folder=inbox|starred|…&label=&q=&page= — the signed-in user's conversations. */
export async function GET(request) {
  const user = await getRequestUser(request);
  if (!user) return unauthorized();
  try {
    const sp = request.nextUrl.searchParams;
    return json(await listConversations(user.id, { folder: sp.get('folder'), label: sp.get('label'), q: sp.get('q'), page: sp.get('page') }));
  } catch (err) {
    return errorResponse(err, 'GET /api/messages');
  }
}

/** POST /api/messages — { productId | sellerId, body }: a buyer writes to a shop (reuses their thread with it). */
export async function POST(request) {
  const user = await getRequestUser(request);
  if (!user) return unauthorized('Log in to message the seller.');
  if (!rateLimit(`msg-start:${user.id}`, { limit: 20, windowMs: 60 * 60 * 1000 }).ok) {
    return json({ error: 'You’ve contacted a lot of shops in a short time. Please try again later.' }, 429);
  }
  try {
    const body = await readJson(request);
    return json(await startConversation(user.id, body), 201);
  } catch (err) {
    return errorResponse(err, 'POST /api/messages');
  }
}

/** PATCH /api/messages — { ids, action, add?, remove? }: toolbar actions on selected conversations. */
export async function PATCH(request) {
  const user = await getRequestUser(request);
  if (!user) return unauthorized();
  try {
    const body = await readJson(request);
    return json(await applyConversationAction(user.id, body));
  } catch (err) {
    return errorResponse(err, 'PATCH /api/messages');
  }
}
