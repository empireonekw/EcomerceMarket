import { getRequestUser } from '@/lib/auth';
import { json, unauthorized } from '@/lib/api';
import { rateLimit } from '@/lib/rate-limit';
import { validateStoreName } from '@/lib/validation';
import { availableStoreNames, isStoreNameAvailable } from '@/lib/data/seller-onboarding';
import { shopNameIdeas } from '@/lib/shop-name-ideas';

const IDEAS_SHOWN = 6;

/**
 * GET /api/seller/onboarding/store-name?name=… — the wizard's live check as you type:
 * { available, error?, suggestions: [...] } where suggestions are free name ideas built from what was typed.
 */
export async function GET(request) {
  const user = await getRequestUser(request);
  if (!user) return unauthorized();
  if (!rateLimit(`store-name:${user.id}`, { limit: 120, windowMs: 60_000 }).ok) return json({ error: 'Slow down a little.' }, 429);
  const name = (request.nextUrl.searchParams.get('name') ?? '').slice(0, 80);
  const error = validateStoreName(name);
  const [available, suggestions] = await Promise.all([
    error ? false : isStoreNameAvailable(name, user.id),
    availableStoreNames(shopNameIdeas(name), user.id).then((ideas) => ideas.slice(0, IDEAS_SHOWN)),
  ]);
  if (error) return json({ available: false, error, suggestions });
  return json({ available, suggestions, ...(!available && { error: 'That shop name is taken. Try another.' }) });
}
