import { siteConfig } from '@/lib/site';

// Wording for a shop's stats (from lib/data/products.js getShopSummary), shared by the product page's
// "Meet the seller" card and the shop page header.

/** "3 months" / "2 years" on Sellpify. */
export function timeOn(since) {
  const months = since ? Math.max(1, Math.round((Date.now() - new Date(since)) / (30.44 * 86_400_000))) : 0;
  if (!months) return null;
  return months < 12 ? `${months} month${months === 1 ? '' : 's'}` : `${Math.floor(months / 12)} year${months >= 24 ? 's' : ''}`;
}

/** "Includes 300 sales and 40 reviews from the seller's other shop, checked by Sellpify." (imported totals) */
export function importedNote({ sales, reviews }) {
  const parts = [
    sales > 0 && `${sales.toLocaleString('en-US')} sale${sales === 1 ? '' : 's'}`,
    reviews > 0 && `${reviews} review${reviews === 1 ? '' : 's'}`,
  ].filter(Boolean);
  return `Includes ${parts.join(' and ')} from the seller’s other shop, checked by ${siteConfig.name}.`;
}
