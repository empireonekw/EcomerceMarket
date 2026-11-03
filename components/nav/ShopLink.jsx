'use client';

import Link from 'next/link';
import { Store } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { ONBOARDING_PATH } from '@/lib/seller-onboarding';

/**
 * Header shop icon (where the messages icon used to be; messages are in the account menu now). Sellers with an open
 * shop go to their dashboard; everyone else to the shop-opening wizard (signed-out visitors log in there first).
 * Admins can't open shops, so they don't get it.
 */
export default function ShopLink() {
  const { user, loading } = useAuth();
  if (loading) return <span aria-hidden="true" className="size-10 shrink-0" />; // same footprint, no layout shift
  if (user?.role === 'admin') return null;

  const open = user?.role === 'seller' && user.storeName;
  return (
    <Link
      href={open ? '/seller/dashboard' : ONBOARDING_PATH}
      aria-label={open ? `Your shop, ${user.storeName}` : 'Sell on Sellpify: open your shop'}
      title={open ? 'Your shop' : 'Sell on Sellpify'}
      className="grid size-10 shrink-0 place-items-center rounded-full text-stone-700 transition-colors hover:bg-white hover:text-black"
    >
      <Store size={20} strokeWidth={1.75} aria-hidden="true" />
    </Link>
  );
}
