// Tiny fetch wrapper for the inbox's JSON API: resolves to { ok, status, data } and never throws.
export async function inboxApi(url, { method = 'GET', body, signal } = {}) {
  try {
    const res = await fetch(url, {
      method,
      signal,
      cache: 'no-store',
      headers: body === undefined ? { Accept: 'application/json' } : { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  } catch (err) {
    if (err?.name === 'AbortError') return { ok: false, status: 0, aborted: true, data: {} };
    return { ok: false, status: 0, data: { error: 'You seem to be offline. Please try again.' } };
  }
}
