// Listing stats helpers shared by the tracking API and the stats page (no server-only imports).

// Days are counted in the marketplace timezone (same setting as Admin → Users date filters).
export const STATS_TIMEZONE = process.env.ADMIN_TIMEZONE || 'Asia/Karachi';
export const STATS_RANGES = [7, 30, 90];

/** "2026-11-06" for `date` in STATS_TIMEZONE. */
export const statsDay = (date = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: STATS_TIMEZONE }).format(date);

/** The last `days` calendar days, oldest first: ["2026-10-08", …, "2026-11-06"]. */
export function lastDays(days, now = new Date()) {
  const today = Date.parse(`${statsDay(now)}T00:00:00Z`);
  return Array.from({ length: days }, (_, i) => new Date(today - (days - 1 - i) * 86_400_000).toISOString().slice(0, 10));
}

const SOCIAL = [
  ['facebook', /(^|\.)(facebook\.com|fb\.com|fb\.me|messenger\.com)$/],
  ['instagram', /(^|\.)instagram\.com$/],
  ['pinterest', /(^|\.)(pinterest\.[a-z.]+|pin\.it)$/],
  ['twitter', /(^|\.)(twitter\.com|x\.com|t\.co)$/],
  ['tumblr', /(^|\.)tumblr\.com$/],
  ['search_engine', /(^|\.)(google\.[a-z.]+|bing\.com|duckduckgo\.com|yahoo\.com|yandex\.[a-z]+)$/],
];

/**
 * Where a visit came from, from document.referrer: { source, term } — `term` is the Sellpify search ("?q=") that led
 * to the product, when there was one.
 */
export function referrerSource(referrer, siteHosts = []) {
  let url;
  try {
    url = new URL(referrer);
  } catch {
    return { source: 'direct', term: null };
  }
  if (siteHosts.includes(url.host)) {
    const q = (url.searchParams.get('q') ?? '').trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 80);
    return { source: 'sellpify', term: q || null };
  }
  const host = url.hostname.replace(/^www\./, '');
  return { source: SOCIAL.find(([, re]) => re.test(host))?.[0] ?? 'other', term: null };
}
