import 'server-only';
import { createHash } from 'node:crypto';
import { siteConfig } from '@/lib/site';

// IndexNow (https://www.indexnow.org): tells Bing, Yandex, Seznam, Naver and the other participating search engines
// the moment a page is added, changed or removed, so they crawl it within minutes instead of waiting for the sitemap.
// Google doesn't take part (it reads /sitemap.xml). Fire-and-forget: a ping can never slow down or break a save.
//
// The key proves the site is ours: it's served at /indexnow-key.txt. INDEXNOW_KEY sets it; otherwise it's derived from
// AUTH_SECRET, so it needs no setup and stays the same across restarts and workers. INDEXNOW=off switches pings off.

const ENDPOINT = 'https://api.indexnow.org/indexnow';
const BATCH_MS = 8000; // gather the URLs of one burst of changes (a bulk approval) into one request
const KEY_RE = /^[a-zA-Z0-9-]{8,128}$/;

/** The IndexNow key, or null when there's no way to make one. */
export function indexNowKey() {
  const own = process.env.INDEXNOW_KEY?.trim();
  if (own && KEY_RE.test(own)) return own;
  const secret = process.env.AUTH_SECRET;
  return secret ? createHash('sha256').update(`indexnow:${secret}`).digest('hex').slice(0, 32) : null;
}

/** Only the live site pings: never development, previews on localhost, or a switched-off server. */
function enabled() {
  if (process.env.NODE_ENV !== 'production' || process.env.INDEXNOW === 'off' || !indexNowKey()) return false;
  try {
    const host = new URL(siteConfig.url).hostname;
    return !/^(localhost|127\.\d+\.\d+\.\d+|\[::1\])$/.test(host) && !/\.(localhost|test)$/.test(host);
  } catch {
    return false;
  }
}

const queue = new Set();
let timer = null;

async function flush() {
  timer = null;
  const urlList = [...queue].slice(0, 10000); // the protocol's limit per request
  queue.clear();
  if (!urlList.length) return;
  const { origin, host } = new URL(siteConfig.url);
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ host, key: indexNowKey(), keyLocation: `${origin}/indexnow-key.txt`, urlList }),
      signal: AbortSignal.timeout(10000),
    });
    // 200 / 202: accepted. 429: too many, they'll still find it through the sitemap.
    if (!res.ok) console.error(`[indexnow] ${res.status} for ${urlList.length} URL(s)`);
  } catch (err) {
    console.error('[indexnow] not sent:', err?.message ?? err);
  }
}

/** Queue site paths ("/products/x", "/shop/y") to announce. Changed, new and removed pages all count. */
export function pingIndexNow(paths) {
  if (!enabled()) return;
  const origin = new URL(siteConfig.url).origin;
  for (const path of paths) if (path) queue.add(`${origin}${path}`);
  if (!timer && queue.size) {
    timer = setTimeout(flush, BATCH_MS);
    timer.unref?.(); // never keeps the process alive on shutdown
  }
}
