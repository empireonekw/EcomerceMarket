'use client';

import { useEffect } from 'react';

const VERIFY_PAGE = '/verify'; // lib/robot-check.js (not imported: it uses node:crypto)

/**
 * When any of this site's API calls answers "robot check required" (proxy.js → lib/robot-check.js), go to /verify
 * and come back here afterwards. Watches window.fetch once, so no single call site has to handle it. Renders nothing.
 */
export default function RobotCheckRedirect() {
  useEffect(() => {
    const original = window.fetch;
    let leaving = false;
    window.fetch = async (...args) => {
      const res = await original(...args);
      if (res.status === 429 && res.headers.get('x-robot-check') === 'required' && !leaving && window.location.pathname !== VERIFY_PAGE) {
        leaving = true;
        window.location.assign(`${VERIFY_PAGE}?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
      }
      return res;
    };
    return () => {
      window.fetch = original;
    };
  }, []);
  return null;
}
