'use client';

import { useCart } from '@/context/CartContext';

/** Navbar cart button — opens the slide-over CartDrawer. */
export default function CartBadge() {
  const { count, openCart, isOpen } = useCart();

  return (
    <button
      type="button"
      onClick={openCart}
      aria-haspopup="dialog"
      aria-expanded={isOpen}
      className="relative grid size-10 shrink-0 place-items-center rounded-full text-stone-700 transition-colors hover:bg-white hover:text-black"
      aria-label={count ? `Open cart, ${count} ${count === 1 ? 'item' : 'items'}` : 'Open cart, empty'}
    >
      {/* Shopping bag */}
      <svg aria-hidden="true" viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinejoin="round">
        <rect x="4" y="7" width="16" height="13.5" rx="2.5" />
        <path d="M8.5 10V6.5a3.5 3.5 0 0 1 7 0V10" strokeLinecap="round" />
      </svg>
      {count > 0 && (
        // key={count} re-mounts the badge so the pop animation replays on every change.
        <span
          key={count}
          className="absolute right-1 top-1 grid h-4 min-w-4 animate-[badge-pop_250ms_ease-out] place-items-center rounded-full bg-brand-500 px-1 text-[10px] font-medium leading-none text-ink ring-2 ring-white"
        >
          {count > 99 ? '99+' : count}
        </span>
      )}
    </button>
  );
}
