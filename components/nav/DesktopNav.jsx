'use client';

import { useEffect, useId, useRef, useState } from 'react';
import Link from '@/components/PrefetchLink';
import { usePathname } from 'next/navigation';
import { LayoutGrid } from 'lucide-react';
import CategoryIcon from '@/components/CategoryIcon';
import { siteConfig } from '@/lib/site';
import { ALL_CATEGORIES_HREF, browsableCategories, categoryHref, topCategories } from '@/lib/category-tree';

// The menu stays the same size however many categories the admin adds; the rest are on /categories.
const MENU_CATEGORIES = 5;
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
 * "Shop" with a hover dropdown of the MENU_CATEGORIES best-stocked categories and a "View all categories" tile.
 * Descriptions are cut to two lines.
 * - Mouse: opens on hover (short close delay so the pointer can travel into the panel). Touch never "hovers".
 * - Keyboard: opens when focus enters, closes on Escape or when focus leaves.
 * - Touch: the chevron button toggles it; tapping "Shop" itself goes to /products.
 */
function ShopMenu({ categories, active }) {
  const shown = topCategories(categories, MENU_CATEGORIES);
  const total = browsableCategories(categories).length;
  const [open, setOpen] = useState(false);
  const closeTimer = useRef(null);
  const openedAt = useRef(0);
  const pathname = usePathname();
  const panelId = useId();

  const show = () => {
    clearTimeout(closeTimer.current);
    if (!open) openedAt.current = Date.now();
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
      // Hover is for a real mouse only: a tap also fires "enter", which would open the menu just before the
      // tap's click toggles it shut again.
      onPointerEnter={(e) => e.pointerType === 'mouse' && show()}
      onPointerLeave={(e) => e.pointerType === 'mouse' && hide()}
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
        // No focus on press: focusing opens the menu (onFocus), and the click would then toggle it straight shut.
        onMouseDown={(e) => e.preventDefault()}
        // A click right after hovering onto the arrow keeps the menu open instead of toggling it shut.
        onClick={() => (open && Date.now() - openedAt.current < 500 ? null : open ? setOpen(false) : show())}
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
            {shown.map((c, i) => (
              <li key={c.slug}>
                <Link href={categoryHref(c)} className="group/item flex gap-3 rounded-xl p-3 transition-colors hover:bg-stone-50">
                  <span className={`grid size-10 shrink-0 place-items-center rounded-full text-gray-900 transition-colors group-hover/item:bg-gray-900 group-hover/item:text-white ${TINTS[i % TINTS.length]}`}>
                    <CategoryIcon slug={c.slug} className="size-5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">{c.name}</span>
                    {/* No `block` here: it would override line-clamp's own display and show the whole text. */}
                    {c.description && <span className="mt-0.5 line-clamp-2 text-xs text-stone-500">{c.description}</span>}
                  </span>
                </Link>
              </li>
            ))}
            <li>
              <Link
                href={ALL_CATEGORIES_HREF}
                className="group/item flex h-full items-center gap-3 rounded-xl border border-dashed border-stone-300 p-3 transition-colors hover:border-ink hover:bg-stone-50"
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-stone-100 text-gray-900 transition-colors group-hover/item:bg-gray-900 group-hover/item:text-white">
                  <LayoutGrid size={18} strokeWidth={1.75} aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium">View all categories</span>
                  <span className="text-xs text-stone-500">
                    {total > shown.length ? `${total - shown.length} more to explore` : 'Browse every category'}
                  </span>
                </span>
              </Link>
            </li>
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

/** Centre navigation (desktop): Home · Shop ▾ · About Us · Blog (selling starts from the shop icon in the header). */
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
    </nav>
  );
}
