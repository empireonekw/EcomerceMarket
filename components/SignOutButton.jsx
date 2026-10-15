'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import SignOutScreen from '@/components/SignOutScreen';

/**
 * Sign-out for areas outside the storefront's AuthProvider (dashboards, shop setup).
 * A plain form post, so it works without JS: the route clears the cookie and 303s to the homepage.
 * The overlay is portalled to <body> so a transformed ancestor (e.g. a slide-in drawer) can't clip it.
 */
export default function SignOutButton({ className = '', children = 'Sign out' }) {
  const [pending, setPending] = useState(false);
  return (
    <form action="/api/auth/logout" method="post" onSubmit={() => setPending(true)}>
      <button type="submit" className={className}>
        {children}
      </button>
      {pending && createPortal(<SignOutScreen />, document.body)}
    </form>
  );
}
