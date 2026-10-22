import { getRequestUser, isSameOrigin } from '@/lib/auth';
import { json, forbidden, readJson, errorResponse } from '@/lib/api';
import { clientIp, rateLimit } from '@/lib/rate-limit';
import { createContactMessage } from '@/lib/data/contact';

/** POST /api/contact — { name, email, message, website? } from the /contact form. Open to guests. */
export async function POST(request) {
  if (!isSameOrigin(request)) return forbidden();
  if (!rateLimit(`contact:${clientIp(request)}`, { limit: 5, windowMs: 60 * 60 * 1000 }).ok) {
    return json({ error: 'You’ve sent several messages in a short time. Please try again in an hour.' }, 429);
  }

  try {
    const body = await readJson(request);
    // Honeypot: the "website" field is hidden from people, so only bots fill it. Pretend it worked.
    if (body.website) return json({ ok: true }, 201);

    const user = await getRequestUser(request);
    await createContactMessage(body, { userId: user?.id });
    return json({ ok: true }, 201);
  } catch (err) {
    return errorResponse(err, 'POST /api/contact');
  }
}
