'use client';

import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { siteConfig } from '@/lib/site';

/** Header call to action: "Sell With Us" for visitors and customers; sellers and admins get their workspace. */
export default function SellCta({ className = '' }) {
  const { user } = useAuth();
  const cta =
    user?.role === 'seller'
      ? user.storeName
        ? { href: '/seller/dashboard', label: 'Seller dashboard' }
        : { href: '/seller/onboarding', label: 'Finish shop setup' }
      : user?.role === 'admin'
        ? { href: '/admin', label: 'Admin dashboard' }
        : siteConfig.sellCta;

  return (
    <Link href={cta.href} className={className}>
      {cta.label}
    </Link>
  );
}
