'use client';

import { useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import CategoryIcon from '@/components/CategoryIcon';
import SellCta from '@/components/nav/SellCta';
import { siteConfig } from '@/lib/site';
import { categoryHref } from '@/lib/category-tree';

// Same pastel order as the homepage category panels.
const TINTS = ['bg-brand-50', 'bg-tint-mint', 'bg-tint-butter', 'bg-tint-sky', 'bg-tint-blush', 'bg-tint-sage'];

/** Pill link; the active page sits on a white pill (the bar is paper-toned). */
function NavLink({ href, active, children, className = '' }) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={`rounded-full px-3.5 py-2 text-sm transition-colors ${active ? 'bg-white text-gray-900 shadow-[0_1px_2px_rgba(20,20,20,0.06)] ring-1 ring-stone-200' : 'text-stone-600 hover:bg-white/80 hover:text-black'} ${className}`}
    >
      {children}
    </Link>
  );
}

/**
 * "Shop" with a hover dropdown of categories.
 * - Mouse: opens on hover (short close delay so the pointer can travel into the panel).
 * - Keyboard: opens when focus enters, closes on Escape or when focus leaves.
 * - Touch: the chevron button toggles it; tapping "Shop" itself goes to /products.
 */
function ShopMenu({ categories, active }) {
  const [open, setOpen] = useState(false);
  const closeTimer = useRef(null);
  const pathname = usePathname();
  const panelId = useId();

  const show = () => {
    clearTimeout(closeTimer.current);
    setOpen(true);
  };
  const hide = () => {
    clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setOpen(false), 150);
  };

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => () => clearTimeout(closeTimer.current), []);

  return (
    <div
      className="relative flex items-center"
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={(e) => !e.currentTarget.contains(e.relatedTarget) && setOpen(false)}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          setOpen(false);
          e.currentTarget.querySelector('a')?.focus();
        }
      }}
    >
      <NavLink href="/products" active={active} className="pr-1.5">
        Shop
      </NavLink>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label="Shop categories"
        className="-ml-0.5 grid size-6 place-items-center rounded-full text-stone-500 transition-colors hover:bg-white hover:text-black"
      >
        <svg aria-hidden="true" viewBox="0 0 20 20" className={`size-3.5 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} fill="currentColor">
          <path d="M5.3 7.3a1 1 0 0 1 1.4 0L10 10.6l3.3-3.3a1 1 0 1 1 1.4 1.4l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 0-1.4Z" />
        </svg>
      </button>

      {/* pt-4 bridges the gap so moving the pointer down into the panel doesn't close it. */}
      <div
        id={panelId}
        className={`absolute left-1/2 top-full z-50 -translate-x-1/2 pt-4 transition-[opacity,translate,visibility] duration-200 ease-out ${
          open ? 'visible translate-y-0 opacity-100' : 'pointer-events-none invisible -translate-y-1 opacity-0'
        }`}
      >
        <div className="w-[34rem] rounded-2xl border border-stone-200 bg-white p-3 shadow-xl">
          <ul className="grid grid-cols-2 gap-1">
            {categories.map((c, i) => (
              <li key={c.slug}>
                <Link href={categoryHref(c)} className="group/item flex gap-3 rounded-xl p-3 transition-colors hover:bg-stone-50">
                  <span className={`grid size-10 shrink-0 place-items-center rounded-full text-gray-900 transition-colors group-hover/item:bg-gray-900 group-hover/item:text-white ${TINTS[i % TINTS.length]}`}>
                    <CategoryIcon slug={c.slug} className="size-5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">{c.name}</span>
                    {c.description && <span className="mt-0.5 line-clamp-2 block text-xs text-stone-500">{c.description}</span>}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-2 flex items-center justify-between border-t border-stone-100 px-3 pb-1 pt-3 text-sm">
            <div className="flex gap-4 text-stone-600">
              <Link href="/products?sort=popular" className="hover:text-ink">
                Best sellers
              </Link>
              <Link href="/products?sort=newest" className="hover:text-ink">
                New arrivals
              </Link>
            </div>
            <Link href="/products" className="font-medium text-ink hover:underline">
              Shop all →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Centre navigation (desktop): Home · Shop ▾ · About Us · Blog · (Sell With Us) */
export default function DesktopNav({ categories }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Main" className="hidden items-center gap-1 lg:flex">
      {siteConfig.mainNav.map((item) =>
        item.dropdown ? (
          <ShopMenu key={item.href} categories={categories} active={item.match(pathname)} />
        ) : (
          <NavLink key={item.href} href={item.href} active={item.match(pathname)}>
            {item.label}
          </NavLink>
        ),
      )}
      <SellCta className="btn btn-sm btn-dark ml-3" />
    </nav>
  );
}
