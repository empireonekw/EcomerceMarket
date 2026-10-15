'use client';

import { useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

const initials = (name = '') =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('') || '?';

// Role-specific dashboard link shown in the account menus.
const DASHBOARDS = {
  admin: { href: '/admin', label: 'Admin dashboard' },
  seller: { href: '/seller/dashboard', label: 'Seller dashboard' },
};

const iconBtn = 'grid size-10 place-items-center rounded-full text-stone-700 transition-colors hover:bg-stone-100 hover:text-black';

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
    <span aria-hidden="true" className={`grid shrink-0 place-items-center rounded-full bg-brand-600 font-medium text-white ${className}`}>
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

const panelClass =
  'absolute right-0 top-full z-50 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-2xl border border-stone-200 bg-white shadow-xl transition-[opacity,translate] duration-150 ease-out starting:-translate-y-1 starting:opacity-0';

/**
 * Header account control (hover or click):
 *  - signed out → "Welcome" card with Log in / Create account
 *  - signed in  → account menu (profile, purchases, dashboard, logout)
 */
export default function UserMenu() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
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

  async function onLogout() {
    close();
    await logout();
    router.push('/');
    router.refresh();
  }

  const item = 'flex items-center gap-3 rounded-xl px-3 py-2 text-sm hover:bg-stone-100';
  return (
    <div {...rootProps} className="relative">
      <button
        {...buttonProps}
        type="button"
        aria-controls={panelId}
        aria-haspopup={user ? 'menu' : 'dialog'}
        aria-label={user ? `Account menu for ${user.name}` : 'Account: log in or create an account'}
        className={`${iconBtn} relative ${open ? 'bg-stone-100 text-black' : ''}`}
      >
        <UserIcon />
        {user && <span aria-hidden="true" className="absolute right-1.5 top-1.5 size-2 rounded-full bg-emerald-500 ring-2 ring-white" />}
      </button>

      {open && !user && (
        <div id={panelId} role="dialog" aria-label="Account" className={`${panelClass} p-6`}>
          <p className="headline text-3xl text-ink">Welcome</p>
          <p className="mt-2 text-sm leading-relaxed text-stone-600">Log in to check out, download your files and sell your work.</p>
          <div className="mt-5 space-y-2.5">
            <Link href={withNext('/login')} className="btn btn-lg btn-dark w-full">
              Log in
            </Link>
            <Link
              href={withNext('/signup')}
              className="btn btn-lg btn-outline w-full"
            >
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
              <p className="truncate text-sm font-medium">{user.name}</p>
              <p className="truncate text-xs text-stone-500">{user.email}</p>
            </div>
          </div>
          <div className="pt-2">
            <Link role="menuitem" href="/profile" className={item}>
              My Profile
            </Link>
            <Link role="menuitem" href="/profile?tab=downloads" className={item}>
              My Purchases
            </Link>
            {DASHBOARDS[user.role] && (
              <Link role="menuitem" href={DASHBOARDS[user.role].href} className={item}>
                {DASHBOARDS[user.role].label}
              </Link>
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
  const router = useRouter();
  const withNext = useLoginHref();
  const link = 'block rounded-full px-4 py-2 hover:bg-stone-100';

  if (loading) return <div className="mx-3 my-2 h-9 animate-pulse rounded-full bg-stone-100" aria-hidden="true" />;

  if (!user) {
    return (
      <div className="grid grid-cols-2 gap-2 border-t border-stone-100 px-1 pt-3">
        <Link href={withNext('/login')} className="btn btn-sm btn-outline">
          Login
        </Link>
        <Link href={withNext('/signup')} className="btn btn-sm btn-dark">
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
      </div>
      <Link href="/profile" className={link}>
        My Profile
      </Link>
      <Link href="/profile?tab=downloads" className={link}>
        My Purchases
      </Link>
      {DASHBOARDS[user.role] && (
        <Link href={DASHBOARDS[user.role].href} className={link}>
          {DASHBOARDS[user.role].label}
        </Link>
      )}
      <button
        type="button"
        onClick={async () => {
          await logout();
          router.push('/');
          router.refresh();
        }}
        className={`${link} w-full text-left text-red-600`}
      >
        Logout
      </button>
    </div>
  );
}
