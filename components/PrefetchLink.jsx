'use client';

import { useState } from 'react';
import Link from 'next/link';

/**
 * <Link> that prefetches the WHOLE page as soon as the shopper shows intent (pointer over it, a touch, or keyboard
 * focus), so the click opens it from the client cache with no server round trip (kept for experimental.staleTimes
 * .static, next.config.mjs). Before that it prefetches like a plain <Link>: static pages in full, dynamic pages
 * (category lists, search) down to their loading.js skeleton, so a page full of links doesn't make the server render
 * every one of them up front. Production only, like all prefetching. Pass `prefetch` to opt out of this behaviour.
 */
export default function PrefetchLink({ prefetch, onMouseEnter, onTouchStart, onFocus, ...props }) {
  const [intent, setIntent] = useState(false);
  if (prefetch !== undefined) return <Link prefetch={prefetch} onMouseEnter={onMouseEnter} onTouchStart={onTouchStart} onFocus={onFocus} {...props} />;

  const warm = (handler) => (e) => {
    if (!intent) setIntent(true);
    handler?.(e);
  };
  return <Link {...props} prefetch={intent ? true : null} onMouseEnter={warm(onMouseEnter)} onTouchStart={warm(onTouchStart)} onFocus={warm(onFocus)} />;
}
