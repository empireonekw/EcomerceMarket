'use client';

import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useMessaging } from '@/components/messages/MessagingProvider';

/** Navbar messages icon (next to the account icon) with a live unread badge. Sellers land in their dashboard inbox; guests log in first. */
export default function InboxLink() {
  const { user, loading } = useAuth();
  const { unread } = useMessaging();
  if (loading) return <span aria-hidden="true" className="size-10 shrink-0" />; // same footprint, no layout shift

  const href = !user ? '/login?next=%2Fmessages' : user.role === 'seller' && user.storeName ? '/seller/messages' : '/messages';
  return (
    <Link
      href={href}
      aria-label={unread ? `Messages, ${unread} unread` : 'Messages'}
      className="relative grid size-10 shrink-0 place-items-center rounded-full text-stone-700 transition-colors hover:bg-white hover:text-black"
    >
      {/* Speech bubble */}
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinejoin="round" strokeLinecap="round">
        <path d="M20.5 11.5c0 4.1-3.8 7.5-8.5 7.5-1.2 0-2.3-.2-3.3-.6L4 19.5l1.2-3.6C4.1 14.7 3.5 13.2 3.5 11.5 3.5 7.4 7.3 4 12 4s8.5 3.4 8.5 7.5Z" />
      </svg>
      {unread > 0 && (
        <span
          key={unread}
          className="absolute right-1 top-1 grid h-4 min-w-4 animate-[badge-pop_250ms_ease-out] place-items-center rounded-full bg-brand-600 px-1 text-[10px] font-medium leading-none text-white ring-2 ring-white"
        >
          {unread > 99 ? '99+' : unread}
        </span>
      )}
    </Link>
  );
}
