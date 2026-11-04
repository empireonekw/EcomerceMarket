import { json, unauthorized } from '@/lib/api';
import { rankkwSeller, removeRankkwLink } from '@/lib/rankkw-link';
import { siteConfig } from '@/lib/site';

/**
 * Rankkw's link to a seller's shop (Bearer token, lib/rankkw-link.js).
 *   GET    → { storeName, email, shopUrl, listingsUrl } (401 once the link is gone)
 *   DELETE → disconnects: the token stops working
 */
export async function GET(request) {
  const seller = await rankkwSeller(request);
  if (!seller) return unauthorized('Not connected.');
  return json({ storeName: seller.storeName, email: seller.email, shopUrl: siteConfig.url, listingsUrl: `${siteConfig.url}/seller/listings` });
}

export async function DELETE(request) {
  const seller = await rankkwSeller(request);
  if (!seller) return json({ ok: true });
  await removeRankkwLink(seller.linkId);
  return json({ ok: true });
}
