'use client';

import { useAuth } from '@/context/AuthContext';

/** On /sell for signed-in shoppers: seller accounts are separate, so sign out and open seller sign-up. */
export default function SwitchToSellerButton({ className = '' }) {
  const { logout } = useAuth();
  return (
    <button type="button" onClick={() => logout({ redirectTo: '/sell/signup' })} className={className}>
      Log out &amp; create a seller account
    </button>
  );
}
