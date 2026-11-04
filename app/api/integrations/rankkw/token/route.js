import { json, forbidden, readJson, errorResponse } from '@/lib/api';
import { isRankkwServer, redeemConnectCode } from '@/lib/rankkw-link';

/**
 * POST /api/integrations/rankkw/token { code, state, rankkwUser } — Rankkw's server only (X-Rankkw-Secret).
 * Swaps a connect code for the seller's token: { token, storeName }. Connecting again replaces the old token.
 */
export async function POST(request) {
  if (!isRankkwServer(request)) return forbidden();
  try {
    const { code, state, rankkwUser } = await readJson(request, 4096);
    const link = await redeemConnectCode(code, state, rankkwUser);
    if (!link) return json({ error: 'The connect code is invalid or expired.' }, 400);
    return json(link);
  } catch (err) {
    return errorResponse(err, 'POST /api/integrations/rankkw/token');
  }
}
