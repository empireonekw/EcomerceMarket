'use client'; // Replaces the root layout when it fails, so it must render its own <html>/<body>.

import { siteConfig } from '@/lib/site';

export default function GlobalError({ error, retry }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, sans-serif', display: 'grid', placeItems: 'center', minHeight: '100dvh', margin: 0 }}>
        <title>{`Something went wrong | ${siteConfig.name}`}</title>
        <div style={{ textAlign: 'center', padding: 24 }}>
          <h1 style={{ fontSize: 24, fontWeight: 600 }}>Something went wrong</h1>
          <p style={{ color: '#57534e' }}>Please try again in a moment.</p>
          {error?.digest && <p style={{ color: '#a8a29e', fontSize: 12 }}>Reference: {error.digest}</p>}
          <button
            type="button"
            onClick={() => retry()}
            style={{ marginTop: 16, padding: '10px 20px', borderRadius: 999, background: '#141414', color: '#fff', border: 0, cursor: 'pointer' }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
