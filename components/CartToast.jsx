'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowRight, Check, X } from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { formatPrice, NEUTRAL_BLUR_DATA_URL } from '@/lib/utils';

const VISIBLE_MS = 6000;

/**
 * "Added to your cart" notice, pinned just below the sticky navbar on the right (rendered inside the header,
 * so it follows the bar as the announcement strip scrolls away). Replaces opening the cart drawer on add.
 * Auto-hides after a few seconds — paused while hovered or focused — and on navigation or Escape.
 */
export default function CartToast() {
  const { added, dismissAdded, openCart, count, totals, currency, isOpen } = useCart();
  const pathname = usePathname();
  // Paused per notice, so a hover on a dismissed notice never stops the next one from hiding.
  const [pausedKey, setPausedKey] = useState(null);
  const paused = added != null && pausedKey === added.key;
  const firstPath = useRef(pathname);

  // Leaving the page (or opening the cart) makes the notice redundant.
  useEffect(() => {
    if (pathname !== firstPath.current) dismissAdded();
    firstPath.current = pathname;
  }, [pathname, dismissAdded]);

  useEffect(() => {
    if (!added || paused) return;
    const t = setTimeout(dismissAdded, VISIBLE_MS);
    return () => clearTimeout(t);
  }, [added, paused, dismissAdded]);

  useEffect(() => {
    if (!added) return;
    const onKey = (e) => e.key === 'Escape' && dismissAdded();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [added, dismissAdded]);

  if (!added || isOpen || pathname.startsWith('/checkout')) return null;
  const { item } = added;

  return (
    <div className="pointer-events-none absolute inset-x-0 top-full">
      <div className="container-page flex justify-end">
        <div
          key={added.key}
          role="status"
          aria-live="polite"
          onMouseEnter={() => setPausedKey(added.key)}
          onMouseLeave={() => setPausedKey(null)}
          onFocus={() => setPausedKey(added.key)}
          onBlur={() => setPausedKey(null)}
          className="pointer-events-auto mt-3 grid w-full max-w-[26rem] grid-cols-[4rem_minmax(0,1fr)] gap-3 rounded-2xl sm:grid-cols-[6rem_minmax(0,1fr)] sm:gap-x-4 border border-stone-200 bg-white p-3 shadow-lift transition-[opacity,translate] duration-300 ease-out starting:-translate-y-2 starting:opacity-0 motion-reduce:transition-none"
        >
          {/* ---------- Thumbnail with a "done" badge (beside the text and the buttons from sm up; phones put the
              buttons on their own full-width row so both fit) ---------- */}
          <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-stone-100 sm:row-span-2">
            {item.coverImage ? (
              <Image src={item.coverImage} alt="" fill sizes="96px" placeholder="blur" blurDataURL={NEUTRAL_BLUR_DATA_URL} className="object-cover" />
            ) : (
              <span aria-hidden="true" className="headline flex h-full items-center justify-center text-3xl text-stone-400">
                {item.title.charAt(0)}
              </span>
            )}
            <span aria-hidden="true" className="absolute bottom-0 left-0 grid size-6 place-items-center rounded-tr-xl bg-emerald-500 text-white sm:size-8">
              <Check size={16} strokeWidth={2.5} />
            </span>
          </div>

          {/* ---------- Text + actions ---------- */}
          <div className="flex min-w-0 flex-col">
            <div className="flex items-start justify-between gap-2">
              <p className="pt-0.5 font-medium text-black">Added to your cart!</p>
              <button
                type="button"
                onClick={dismissAdded}
                aria-label="Dismiss"
                className="-mr-1 -mt-1 grid size-8 shrink-0 place-items-center rounded-full text-stone-500 transition-colors hover:bg-stone-100 hover:text-black"
              >
                <X size={18} strokeWidth={2} aria-hidden="true" />
              </button>
            </div>
            <p className="truncate text-sm text-stone-600">{item.title}</p>
            <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-medium text-emerald-800">
                {item.price === 0 ? 'Free' : formatPrice(item.price, item.currency)}
              </span>
              <span className="text-stone-500">
                {count} item{count === 1 ? '' : 's'} · {formatPrice(totals.total, currency)}
              </span>
            </p>
          </div>

          <div className="col-span-2 flex gap-2 sm:col-span-1 sm:col-start-2">
            <button type="button" onClick={openCart} className="btn btn-sm btn-outline shrink-0">
              View cart
            </button>
            <Link href="/checkout" onClick={dismissAdded} className="btn btn-sm btn-dark flex-1">
              Checkout
              <ArrowRight size={15} strokeWidth={2} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
