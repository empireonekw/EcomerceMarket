'use client';

/** Fire-and-forget listing stats event (POST /api/stats/track); never throws, never delays the page. */
export function trackListing(productId, event, referrer = '') {
  try {
    const body = JSON.stringify({ productId, event, referrer });
    if (navigator.sendBeacon?.('/api/stats/track', new Blob([body], { type: 'application/json' }))) return;
    fetch('/api/stats/track', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true }).catch(() => {});
  } catch {}
}
