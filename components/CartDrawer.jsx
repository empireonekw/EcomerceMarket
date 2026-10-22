'use client';

import { useEffect, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCart } from '@/context/CartContext';
import { formatPrice, NEUTRAL_BLUR_DATA_URL } from '@/lib/utils';
import { formatTaxRate } from '@/lib/pricing';

function SummaryRow({ label, value, strong = false }) {
  return (
    <div className={`flex justify-between ${strong ? 'text-base font-medium' : 'text-sm text-stone-600'}`}>
      <dt>{label}</dt>
      <dd className={strong ? '' : 'font-medium text-ink'}>{value}</dd>
    </div>
  );
}

/**
 * Native <dialog> slide-over: the browser provides focus trapping, Escape-to-close,
 * the backdrop, and inert background content. Slide animation is pure CSS (@starting-style).
 */
export default function CartDrawer() {
  const { items, totals, currency, isOpen, closeCart, removeFromCart } = useCart();
  const dialogRef = useRef(null);
  const pathname = usePathname();

  // Sync React state → dialog.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen && !dialog.open) dialog.showModal();
    if (!isOpen && dialog.open) dialog.close();
  }, [isOpen]);

  // Close when navigating (e.g. clicking a product or "Proceed to Checkout").
  useEffect(() => {
    closeCart();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const money = (cents) => formatPrice(cents, currency);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="cart-title"
      onClose={closeCart} // fired by Escape too
      onClick={(e) => e.target === e.currentTarget && closeCart()} // backdrop click
      className="fixed inset-0 m-0 ml-auto h-dvh max-h-dvh w-full max-w-md translate-x-full bg-white p-0 text-ink shadow-2xl transition-[translate,overlay,display] transition-discrete duration-300 ease-out backdrop:bg-black/0 backdrop:transition-[background-color,overlay,display] backdrop:transition-discrete backdrop:duration-300 open:translate-x-0 open:backdrop:bg-black/40 starting:open:translate-x-full starting:open:backdrop:bg-black/0 motion-reduce:transition-none"
    >
      <div className="flex h-full flex-col">
        <header className="flex items-center justify-between border-b border-stone-200 px-5 py-4">
          <h2 id="cart-title" className="headline text-2xl">
            Your cart <span className="text-stone-400">({items.length})</span>
          </h2>
          <button
            type="button"
            onClick={closeCart}
            autoFocus
            className="grid size-9 place-items-center rounded-full hover:bg-stone-100"
            aria-label="Close cart"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" />
            </svg>
          </button>
        </header>

        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
            <span className="grid size-14 place-items-center rounded-full bg-stone-100 text-stone-400">
              <svg aria-hidden="true" viewBox="0 0 24 24" className="size-7" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path d="M6 7h12l-1 13H7L6 7Z" strokeLinejoin="round" />
                <path d="M9 7a3 3 0 0 1 6 0" strokeLinecap="round" />
              </svg>
            </span>
            <p className="mt-4 font-medium">Your cart is empty</p>
            <p className="mt-1 text-sm text-stone-500">Find something great to make with.</p>
            <Link href="/products" className="btn btn-md btn-dark mt-6">
              Browse products
            </Link>
          </div>
        ) : (
          <>
            <ul className="flex-1 divide-y divide-stone-100 overflow-y-auto overscroll-contain px-5">
              {items.map((item) => (
                <li key={item._id} className="flex gap-4 py-4">
                  <Link href={`/products/${item.slug}`} className="relative aspect-[4/3] w-24 shrink-0 overflow-hidden rounded-xl bg-stone-100">
                    {item.coverImage && (
                      <Image
                        src={item.coverImage}
                        alt=""
                        fill
                        sizes="96px"
                        placeholder="blur"
                        blurDataURL={NEUTRAL_BLUR_DATA_URL}
                        className="object-cover"
                      />
                    )}
                  </Link>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <Link href={`/products/${item.slug}`} className="line-clamp-2 text-sm font-medium hover:underline">
                      {item.title}
                    </Link>
                    <p className="mt-0.5 text-xs text-stone-500">{item.accessLink ? 'Instant access link' : 'Instant digital download'}</p>
                    <div className="mt-auto flex items-center justify-between pt-2">
                      <span className="text-sm font-medium">{item.price === 0 ? 'Free' : money(item.price)}</span>
                      <button
                        type="button"
                        onClick={() => removeFromCart(item._id)}
                        className="text-xs font-medium text-stone-500 underline-offset-2 hover:text-red-600 hover:underline"
                        aria-label={`Remove ${item.title} from cart`}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            <footer className="border-t border-stone-200 px-5 py-5">
              <dl className="space-y-2">
                {/* Fee and tax lines only when they add something; otherwise the total says it all. */}
                {(totals.fee > 0 || totals.tax > 0) && (
                  <>
                    <SummaryRow label="Subtotal" value={money(totals.subtotal)} />
                    {totals.fee > 0 && <SummaryRow label="Service fee" value={money(totals.fee)} />}
                    {totals.tax > 0 && <SummaryRow label={`Tax (${formatTaxRate()})`} value={money(totals.tax)} />}
                  </>
                )}
                <div className={totals.fee > 0 || totals.tax > 0 ? 'border-t border-stone-200 pt-2' : ''}>
                  <SummaryRow label="Total" value={money(totals.total)} strong />
                </div>
              </dl>
              <Link
                href="/checkout"
                className="btn btn-lg btn-primary mt-5 w-full"
              >
                Proceed to Checkout
                <svg aria-hidden="true" viewBox="0 0 20 20" className="size-4" fill="currentColor">
                  <path d="M11.3 4.3a1 1 0 0 1 1.4 0l5 5a1 1 0 0 1 0 1.4l-5 5a1 1 0 0 1-1.4-1.4l3.3-3.3H3a1 1 0 1 1 0-2h11.6l-3.3-3.3a1 1 0 0 1 0-1.4Z" />
                </svg>
              </Link>
              <button
                type="button"
                onClick={closeCart}
                className="btn btn-md mt-2 w-full text-stone-600 hover:bg-stone-100"
              >
                Continue shopping
              </button>
              <p className="mt-2 flex items-center justify-center gap-1.5 text-xs text-stone-500">
                <svg aria-hidden="true" viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="5" y="11" width="14" height="10" rx="2" />
                  <path d="M8 11V8a4 4 0 0 1 8 0v3" />
                </svg>
                Secure checkout · Instant delivery
              </p>
            </footer>
          </>
        )}
      </div>
    </dialog>
  );
}
