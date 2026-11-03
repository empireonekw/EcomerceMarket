import { getRequestUser } from '@/lib/auth';
import { json, unauthorized } from '@/lib/api';
import { rateLimit } from '@/lib/rate-limit';
import { validateStoreName } from '@/lib/validation';
import { isStoreNameAvailable } from '@/lib/data/seller-onboarding';

/** GET /api/seller/onboarding/store-name?name=… — { available, error? } for the wizard's live check as you type. */
export async function GET(request) {
  const user = await getRequestUser(request);
  if (!user) return unauthorized();
  if (!rateLimit(`store-name:${user.id}`, { limit: 120, windowMs: 60_000 }).ok) return json({ error: 'Slow down a little.' }, 429);
  const name = (request.nextUrl.searchParams.get('name') ?? '').slice(0, 80);
  const error = validateStoreName(name);
  if (error) return json({ available: false, error });
  const available = await isStoreNameAvailable(name, user.id);
  return json({ available, ...(!available && { error: 'That shop name is taken. Try another.' }) });
}
