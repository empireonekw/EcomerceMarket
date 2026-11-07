'use client';

import { useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Store } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useMessaging } from '@/components/messages/MessagingProvider';
import { ONBOARDING_PATH } from '@/lib/seller-onboarding';
import VerifiedBadge from '@/components/VerifiedBadge';

const initials = (name = '') =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('') || '?';

/**
 * Account-menu entries per role (desktop dropdown + mobile menu). Everyone gets Account settings, Purchases and
 * Messages (sellers' inbox lives in their workspace); shoppers also get "Sell on Sellpify" (`promo`), sellers their
 * workspace, admins the marketplace. `inbox: true` marks the Messages entry, which shows the unread count.
 */
function accountLinks(user) {
  const settings = { href: '/profile', label: 'Account settings' };
  const purchases = { href: '/profile?tab=downloads', label: 'Purchases' };
  const support = { href: '/support', label: 'Help & support' }; // opens the chat with the Sellpify team
  if (user.role === 'seller') {
    if (!user.storeName) {
      return [
        { href: ONBOARDING_PATH, label: 'Finish opening your shop', promo: true },
        { href: '/messages', label: 'Messages', inbox: true },
        purchases,
        support,
        settings,
      ];
    }
    return [
      { href: '/seller/dashboard', label: 'Seller dashboard' },
      { href: '/seller/listings', label: 'Listings' },
      { href: '/seller/messages', label: 'Messages', inbox: true },
      { href: '/seller/sales', label: 'Sales history' },
      { href: '/seller/payouts', label: 'Payouts' },
      { href: '/seller/dashboard#shop', label: 'Shop settings' },
      purchases,
      support,
      settings,
    ];
  }
  if (user.role === 'admin') {
    return [
      { href: '/admin', label: 'Admin dashboard' },
      { href: '/admin/users', label: 'Users' },
      { href: '/admin/orders', label: 'Orders & sales' },
      { href: '/messages', label: 'Messages', inbox: true },
      settings,
    ];
  }
  return [settings, purchases, { href: '/messages', label: 'Messages', inbox: true }, support, { href: ONBOARDING_PATH, label: 'Sell on Sellpify', promo: true }];
}

/** "3" (or "99+") unread messages, next to the Messages entry. */
function UnreadCount({ count }) {
  if (!count) return null;
  return (
    <span className="ml-auto rounded-full bg-brand-500 px-2 py-0.5 text-xs font-medium leading-none text-ink tabular-nums">
      {count > 99 ? '99+' : count}
      <span className="sr-only"> unread</span>
    </span>
  );
}

const ROLE_BADGES = { seller: 'Seller', admin: 'Admin' };

function RoleBadge({ role }) {
  if (!ROLE_BADGES[role]) return null;
  return <span className="shrink-0 rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-600">{ROLE_BADGES[role]}</span>;
}

const iconBtn = 'grid size-10 place-items-center rounded-full text-stone-700 transition-colors hover:bg-white hover:text-black';

function UserIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round">
      <circle cx="12" cy="8" r="4" />
      <path d="M4.5 20.5c1.2-3.7 4-5.5 7.5-5.5s6.3 1.8 7.5 5.5" />
    </svg>
  );
}

export function Avatar({ name, className = 'size-9 text-sm' }) {
  return (
    <span aria-hidden="true" className={`grid shrink-0 place-items-center rounded-full bg-brand-500 font-medium text-ink ${className}`}>
      {initials(name)}
    </span>
  );
}

function useLoginHref() {
  const pathname = usePathname();
  const skip = ['/login', '/signup'].includes(pathname);
  return (base) => (skip || pathname === '/' ? base : `${base}?next=${encodeURIComponent(pathname)}`);
}

const HOVER_CLOSE_DELAY = 180;

/**
 * Popover that opens on mouse hover (desktop) or click/tap (touch, keyboard).
 * A click while hover-opened "pins" it open instead of closing it.
 */
function useHoverPopover() {
  const [open, setOpen] = useState(false);
  const openedBy = useRef(null);
  const closeTimer = useRef(null);
  const rootRef = useRef(null);
  const buttonRef = useRef(null);
  const pathname = usePathname();

  const show = (by) => {
    clearTimeout(closeTimer.current);
    openedBy.current = by;
    setOpen(true);
  };
  const close = () => {
    clearTimeout(closeTimer.current);
    setOpen(false);
  };

  useEffect(() => close(), [pathname]);
  useEffect(() => () => clearTimeout(closeTimer.current), []);
  useEffect(() => {
    if (!open) return;
    const onPointer = (e) => !rootRef.current?.contains(e.target) && close();
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      close();
      buttonRef.current?.focus();
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return {
    open,
    close,
    rootProps: {
      ref: rootRef,
      onPointerEnter: (e) => e.pointerType === 'mouse' && show('hover'),
      onPointerLeave: (e) => {
        if (e.pointerType !== 'mouse' || openedBy.current !== 'hover') return;
        closeTimer.current = setTimeout(() => setOpen(false), HOVER_CLOSE_DELAY);
      },
    },
    buttonProps: {
      ref: buttonRef,
      'aria-expanded': open,
      onClick: () => {
        if (open && openedBy.current === 'hover') openedBy.current = 'click'; // pin
        else if (open) close();
        else show('click');
      },
    },
  };
}

// Desktop: a 20rem card under the icon. Phones: the icon isn't at the right edge (cart and menu follow it), so a
// card hung off it would leave the screen; there the menu's root is static and the card spans the header row instead.
const panelClass =
  'absolute top-full z-50 mt-2 max-sm:inset-x-3 sm:right-0 sm:w-80 rounded-2xl border border-stone-200 bg-white shadow-xl transition-[opacity,translate] duration-150 ease-out starting:-translate-y-1 starting:opacity-0';

/**
 * Header account control (hover or click):
 *  - signed out → "Welcome" card with Log in / Create account
 *  - signed in  → account menu (profile, purchases, dashboard, logout)
 */
export default function UserMenu() {
  const { user, loading, logout } = useAuth();
  const { unread } = useMessaging();
  const withNext = useLoginHref();
  const { open, close, rootProps, buttonProps } = useHoverPopover();
  const panelId = useId();

  // Same footprint while resolving, so the header doesn't shift.
  if (loading) {
    return (
      <span className={`${iconBtn} text-stone-300`} aria-hidden="true">
        <UserIcon />
      </span>
    );
  }

  function onLogout() {
    close();
    logout();
  }

  const item = 'flex items-center gap-3 rounded-xl px-3 py-2 text-sm hover:bg-stone-100';
  return (
    <div {...rootProps} className="sm:relative">
      <button
        {...buttonProps}
        type="button"
        aria-controls={panelId}
        aria-haspopup={user ? 'menu' : 'dialog'}
        aria-label={user ? `Account menu for ${user.name}${unread ? `, ${unread} unread messages` : ''}` : 'Account: log in or create an account'}
        className={`${iconBtn} relative ${open ? 'bg-white text-black' : ''}`}
      >
        <UserIcon />
        {/* Unread messages (the inbox moved into this menu); otherwise a dot that says "signed in". */}
        {user && unread > 0 ? (
          <span
            key={unread}
            aria-hidden="true"
            className="absolute right-0.5 top-0.5 grid h-4 min-w-4 animate-[badge-pop_250ms_ease-out] place-items-center rounded-full bg-brand-500 px-1 text-xs font-medium leading-none text-ink ring-2 ring-white"
          >
            {unread > 99 ? '99+' : unread}
          </span>
        ) : (
          user && <span aria-hidden="true" className="absolute right-1.5 top-1.5 size-2 rounded-full bg-emerald-500 ring-2 ring-white" />
        )}
      </button>

      {open && !user && (
        <div id={panelId} role="dialog" aria-label="Account" className={`${panelClass} p-6`}>
          <p className="headline text-3xl text-ink">Welcome</p>
          <p className="mt-2 text-sm leading-relaxed text-stone-600">Log in to check out, download your files and sell your work.</p>
          <div className="mt-5 space-y-3">
            <Link href={withNext('/login')} prefetch className="btn btn-lg btn-dark w-full">
              Log in
            </Link>
            <Link href={withNext('/signup')} prefetch className="btn btn-lg btn-outline w-full">
              Create account
            </Link>
          </div>
        </div>
      )}

      {open && user && (
        <div id={panelId} role="menu" className={`${panelClass} p-2`}>
          <div className="flex items-center gap-3 border-b border-stone-100 px-3 pb-3 pt-2">
            <Avatar name={user.name} />
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-sm font-medium">
                <span className="truncate">{user.name}</span>
                <RoleBadge role={user.role} />
              </p>
              <p className="flex min-w-0 items-center gap-1 text-xs text-stone-500">
                <span className="truncate">{user.role === 'seller' && user.storeName ? user.storeName : user.email}</span>
                {user.role === 'seller' && user.verified && <VerifiedBadge size={13} />}
              </p>
            </div>
          </div>
          <div className="pt-2">
            {accountLinks(user).map((l) =>
              l.promo ? (
                <Link
                  key={l.href}
                  role="menuitem"
                  href={l.href}
                  onClick={close}
                  className="my-1 flex items-center gap-3 rounded-xl bg-brand-50 px-3 py-3 text-sm font-medium text-ink hover:bg-brand-100"
                >
                  <Store size={17} strokeWidth={1.75} aria-hidden="true" />
                  {l.label}
                </Link>
              ) : (
                <Link key={l.href} role="menuitem" href={l.href} onClick={close} className={item}>
                  {l.label}
                  {l.inbox && <UnreadCount count={unread} />}
                </Link>
              ),
            )}
            <button role="menuitem" type="button" onClick={onLogout} className={`${item} w-full text-left text-red-600 hover:bg-red-50`}>
              Logout
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Account links inside the mobile menu panel. */
export function MobileAuthLinks() {
  const { user, loading, logout } = useAuth();
  const { unread } = useMessaging();
  const withNext = useLoginHref();
  const link = 'block rounded-full px-4 py-2 hover:bg-stone-100';

  if (loading) return <div className="mx-3 my-2 h-9 animate-pulse rounded-full bg-stone-100" aria-hidden="true" />;

  if (!user) {
    return (
      <div className="grid grid-cols-2 gap-2 border-t border-stone-100 px-1 pt-3">
        <Link href={withNext('/login')} prefetch className="btn btn-sm btn-outline">
          Login
        </Link>
        <Link href={withNext('/signup')} prefetch className="btn btn-sm btn-dark">
          Sign Up
        </Link>
      </div>
    );
  }

  return (
    <div className="border-t border-stone-100 pt-2 text-sm font-medium">
      <div className="flex items-center gap-3 px-3 py-2">
        <Avatar name={user.name} className="size-8 text-xs" />
        <span className="truncate">{user.name}</span>
        <RoleBadge role={user.role} />
      </div>
      {accountLinks(user).map((l) => (
        <Link key={l.href} href={l.href} className={`${link} flex items-center gap-2 ${l.promo ? 'text-brand-800' : ''}`}>
          {l.promo && <Store size={16} strokeWidth={1.75} aria-hidden="true" />}
          {l.label}
          {l.inbox && <UnreadCount count={unread} />}
        </Link>
      ))}
      <button
        type="button"
        onClick={() => logout()}
        className={`${link} w-full text-left text-red-600`}
      >
        Logout
      </button>
    </div>
  );
}
