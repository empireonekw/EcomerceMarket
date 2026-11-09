'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { isTrackedPath } from '@/lib/site-stats';

const DAY_KEY = 'sp_visit_day';
const SEEN_KEY = 'sp_visit_seen';
const today = () => new Date().toLocaleDateString('en-CA');

function read(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function write(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* private mode / storage blocked: the visit still counts as a page view */
  }
}

/**
 * Counts storefront page views for the admin dashboard (POST /api/stats/visit): one beacon per page, flagged as the
 * browser's first visit of the day (unique visitors) and first visit ever (new visitors). No cookies, no ids: the two
 * flags live in this browser's localStorage. Admin and seller pages are not counted.
 */
export default function VisitTracker() {
  const pathname = usePathname();
  const last = useRef(null);

  useEffect(() => {
    if (!pathname || pathname === last.current || !isTrackedPath(pathname) || navigator.webdriver) return;
    const firstOfSession = last.current === null;
    last.current = pathname;
    const day = today();
    const firstToday = read(DAY_KEY) !== day;
    const firstEver = firstToday && !read(SEEN_KEY);
    if (firstToday) write(DAY_KEY, day);
    if (firstEver) write(SEEN_KEY, '1');
    const body = JSON.stringify({
      path: pathname,
      // Where the visitor came from only matters on the first page they open.
      referrer: firstOfSession ? document.referrer : '',
      firstToday,
      firstEver,
    });
    try {
      if (navigator.sendBeacon?.('/api/stats/visit', new Blob([body], { type: 'application/json' }))) return;
    } catch {
      /* fall through to fetch */
    }
    fetch('/api/stats/visit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true }).catch(() => {});
  }, [pathname]);

  return null;
}
