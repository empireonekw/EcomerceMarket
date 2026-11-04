'use client';

import { useState } from 'react';

/** Approve / cancel on /connect/rankkw. Approving gets Rankkw's return address with a one-time code and goes there. */
export default function RankkwConnectButtons({ state, origin, cancelHref, email }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  async function approve() {
    setPending(true);
    setError('');
    try {
      const res = await fetch('/api/integrations/rankkw/authorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state, origin }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.redirect) throw new Error(data.error || 'Could not connect. Please try again.');
      window.location.assign(data.redirect);
    } catch (err) {
      setError(err.message);
      setPending(false);
    }
  }

  return (
    <div className="grid gap-2">
      {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <button type="button" onClick={approve} disabled={pending} className="btn btn-md btn-primary w-full">
        {pending ? 'Connecting…' : 'Connect'}
      </button>
      <a href={cancelHref} className="btn btn-md w-full text-stone-600 hover:bg-stone-100">Cancel</a>
      <p className="mt-2 text-center text-xs text-stone-500">Signed in as {email}</p>
    </div>
  );
}
