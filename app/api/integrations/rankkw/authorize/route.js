import { getRequestUser } from '@/lib/auth';
import { json, unauthorized, forbidden, readJson, errorResponse } from '@/lib/api';
import { createConnectCode, rankkwCallback } from '@/lib/rankkw-link';

/**
 * POST /api/integrations/rankkw/authorize { state, origin } — the seller approved on /connect/rankkw.
 * Returns { redirect }: Rankkw's callback with a 5-minute code its server swaps for a token (../token).
 */
export async function POST(request) {
  const user = await getRequestUser(request); // same-origin enforced
  if (!user) return unauthorized();
  if (user.role !== 'seller' || !user.storeName) return forbidden('Open your Sellpify shop first.');
  try {
    const { state, origin } = await readJson(request, 2048);
    if (!/^[A-Za-z0-9_-]{16,128}$/.test(String(state ?? ''))) return json({ error: 'This link has expired. Start again from Rankkw.' }, 400);
    const code = createConnectCode(user.id, state);
    return json({ redirect: `${rankkwCallback(origin)}?${new URLSearchParams({ code, state })}` });
  } catch (err) {
    return errorResponse(err, 'POST /api/integrations/rankkw/authorize');
  }
}
