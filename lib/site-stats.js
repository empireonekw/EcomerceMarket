// Site-wide visit stats (models/SiteStat.js): helpers shared by the tracking API, the tracker and the admin dashboard.
// No server-only imports: the client tracker uses isTrackedPath too.

/** Kinds of page a visit lands on, for "Most visited sections". */
export const PAGE_SECTIONS = [
  { key: 'home', label: 'Homepage' },
  { key: 'product', label: 'Product pages' },
  { key: 'category', label: 'Categories & tags' },
  { key: 'shop', label: 'Shop pages' },
  { key: 'search', label: 'Search & listings' },
  { key: 'sell', label: 'Selling & sign-up' },
  { key: 'account', label: 'Account & checkout' },
  { key: 'info', label: 'Help & info' },
];

export const DEVICES = [
  { key: 'mobile', label: 'Mobile' },
  { key: 'desktop', label: 'Desktop' },
  { key: 'tablet', label: 'Tablet' },
];

/** Admin and seller workspaces are staff/seller tools, not storefront visits. */
export const isTrackedPath = (pathname = '') => !/^\/(admin|seller|api|verify)(\/|$)/.test(pathname);

/** "/products/x" → 'product'. Unknown storefront paths are category pages (they live at the site root). */
export function sectionOf(pathname = '/') {
  const p = pathname.split('?')[0].replace(/\/+$/, '') || '/';
  if (p === '/') return 'home';
  if (p.startsWith('/products/')) return 'product';
  if (p === '/products' || p.startsWith('/search')) return 'search';
  if (p.startsWith('/shop/')) return 'shop';
  if (p.startsWith('/tags') || p.startsWith('/categories')) return 'category';
  if (/^\/(sell|sell-on-sellpify|signup|login|forgot-password|connect)(\/|$)/.test(p)) return 'sell';
  if (/^\/(profile|checkout|messages|support)(\/|$)/.test(p)) return 'account';
  if (/^\/(about|help|how-it-works|contact|legal|privacy|terms|blog)(\/|$)/.test(p)) return 'info';
  return 'category';
}

/** Rough device class from the User-Agent. */
export function deviceOf(userAgent = '') {
  if (/iPad|Tablet|PlayBook|Silk|(Android(?!.*Mobile))/i.test(userAgent)) return 'tablet';
  if (/Mobi|iPhone|iPod|Android|IEMobile|Opera Mini/i.test(userAgent)) return 'mobile';
  return 'desktop';
}

/** Crawlers, previews and headless browsers: never counted as visitors. */
export const BOT_UA =
  /bot|crawl|spider|slurp|facebookexternalhit|embedly|preview|headless|lighthouse|pagespeed|gtmetrix|pingdom|uptime|monitor|curl|wget|python|httpclient|java\/|okhttp|axios|node-fetch|go-http/i;

/** Cloudflare's two-letter country code; 'XX' / 'T1' (unknown / Tor) count as unknown. */
export function countryOf(code) {
  const c = String(code ?? '').toUpperCase();
  return /^[A-Z]{2}$/.test(c) && c !== 'XX' && c !== 'T1' ? c : 'ZZ';
}

/** "PK" → "Pakistan" (English names from the platform), 'ZZ' → "Unknown". */
export function countryName(code) {
  if (code === 'ZZ') return 'Unknown';
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' }).of(code) ?? code;
  } catch {
    return code;
  }
}
