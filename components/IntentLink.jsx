'use client';

import { useState } from 'react';
import Link from 'next/link';

/**
 * A <Link> that loads its page in full only once the user shows intent: pointer over it, keyboard focus, or a touch
 * (node_modules/next/dist/docs/01-app/02-guides/prefetching.md, "Hover-triggered prefetch").
 *
 * Before that it keeps Next's default prefetch, which for a dynamic page is only the light shell down to its
 * loading.jsx. Full prefetching of every visible link (`prefetch={true}`) made each dashboard view render ~10 other
 * pages at once on the server, and a real click had to queue behind them. Intent arrives 100–300 ms before the click,
 * so the page is usually ready by the time the click lands, at a fraction of the server work.
 */
export default function IntentLink({ onPointerEnter, onFocus, onTouchStart, ...props }) {
  const [intent, setIntent] = useState(false);
  const show = (handler) => (e) => {
    setIntent(true);
    handler?.(e);
  };
  return (
    <Link
      {...props}
      prefetch={intent ? true : null}
      onPointerEnter={show(onPointerEnter)}
      onFocus={show(onFocus)}
      onTouchStart={show(onTouchStart)}
    />
  );
}
