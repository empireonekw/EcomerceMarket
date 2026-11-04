import { json, unauthorized, readJson, errorResponse } from '@/lib/api';
import { uploadProblem } from '@/lib/listing';
import { rateLimit } from '@/lib/rate-limit';
import { createUploadTicket, rankkwSeller } from '@/lib/rankkw-link';
import { uploadDriver } from '@/lib/uploads';
import { siteConfig } from '@/lib/site';

/**
 * POST /api/integrations/rankkw/upload-ticket { name, size } (Bearer) — lets the seller's browser on Rankkw upload one
 * file buyers get, straight to us (../upload), within 15 minutes. Returns { uploadUrl }.
 */
export async function POST(request) {
  const seller = await rankkwSeller(request);
  if (!seller) return unauthorized('Not connected.');
  if (!uploadDriver()) return json({ error: 'File uploads aren’t set up on Sellpify yet.' }, 409);
  if (!rateLimit(`rankkw-upload:${seller.id}`, { limit: 120, windowMs: 60 * 60 * 1000 }).ok) {
    return json({ error: 'Too many uploads in a short time. Please try again later.' }, 429);
  }
  try {
    const { name, size } = await readJson(request, 1024);
    const problem = uploadProblem('source', { name: String(name ?? ''), size: Number(size) });
    if (problem) return json({ error: problem }, 400);
    const ticket = createUploadTicket(seller.id, String(name), Number(size));
    return json({ uploadUrl: `${siteConfig.url}/api/integrations/rankkw/upload?${new URLSearchParams({ ticket })}` });
  } catch (err) {
    return errorResponse(err, 'POST /api/integrations/rankkw/upload-ticket');
  }
}
