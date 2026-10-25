'use client';

import { createContext, useCallback, useContext, useMemo, useState, useSyncExternalStore } from 'react';
import { isAccessLink } from '@/lib/utils';
import { calculateTotals } from '@/lib/pricing';

/**
 * Global cart state, persisted to localStorage.
 *
 * Persistence is an external store read with useSyncExternalStore, which gives us:
 *  - no hydration mismatch (server + first client render see an empty cart, then the saved one),
 *  - cross-tab sync via the `storage` event,
 *  - synchronous updates → the badge, buttons and drawer update in the same frame as the click.
 *
 * Digital goods: each product appears at most once. Prices are display-only — the server re-prices at checkout.
 */

const STORAGE_KEY = 'apex-cart-v1';
const EMPTY = Object.freeze([]);
const listeners = new Set();
let cache = null;

function readCart() {
  if (cache) return cache;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '[]');
    cache = Array.isArray(parsed) ? parsed.filter((i) => i && typeof i._id === 'string') : EMPTY;
  } catch {
    cache = EMPTY;
  }
  return cache;
}

function writeCart(items) {
  cache = items;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // Storage full or disabled (private mode): keep the in-memory cart for this tab.
  }
  listeners.forEach((notify) => notify());
}

function subscribe(notify) {
  listeners.add(notify);
  const onStorage = (e) => {
    if (e.key === STORAGE_KEY) {
      cache = null;
      notify();
    }
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(notify);
    window.removeEventListener('storage', onStorage);
  };
}

const getServerSnapshot = () => EMPTY;
const noopSubscribe = () => () => {};

/** Only the fields the cart UI needs — keeps localStorage small. */
// accessLink: delivered as an access link (Figma / Notion / external) rather than a file — drives the cart wording.
const toCartItem = ({ _id, slug, title, price, currency = 'USD', coverImage, accessLink, deliveryType, fileFormat }) => ({
  _id: String(_id),
  slug,
  title,
  price,
  currency,
  coverImage,
  accessLink: accessLink ?? isAccessLink({ deliveryType, fileFormat }),
});

const CartContext = createContext(null);

export function CartProvider({ children }) {
  const items = useSyncExternalStore(subscribe, readCart, getServerSnapshot);
  // false during SSR + hydration, true afterwards — lets UIs avoid flashing "empty cart".
  const hydrated = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const [isOpen, setIsOpen] = useState(false);
  // The "Added to your cart" notice under the navbar (components/CartToast.jsx). `key` restarts it on every add.
  const [added, setAdded] = useState(null);

  /** Adds a product and shows the "Added to your cart" notice; `notify: false` skips it (e.g. Buy now). */
  const addToCart = useCallback((product, { notify = true } = {}) => {
    const current = readCart();
    if (!current.some((i) => i._id === String(product._id))) writeCart([...current, toCartItem(product)]);
    if (notify) setAdded({ item: toCartItem(product), key: Date.now() });
  }, []);

  const dismissAdded = useCallback(() => setAdded(null), []);

  const removeFromCart = useCallback((id) => writeCart(readCart().filter((i) => i._id !== String(id))), []);

  const clearCart = useCallback(() => writeCart(EMPTY), []);

  /** Replace cart lines with fresh server data (e.g. after a price change), dropping anything not returned. */
  const syncCart = useCallback((serverItems) => {
    const fresh = new Map(serverItems.map((p) => [String(p._id), toCartItem(p)]));
    writeCart(readCart().filter((i) => fresh.has(i._id)).map((i) => fresh.get(i._id)));
  }, []);

  const getCartTotal = useCallback(() => readCart().reduce((sum, i) => sum + (i.price ?? 0), 0), []);

  const value = useMemo(() => {
    const subtotal = items.reduce((sum, i) => sum + (i.price ?? 0), 0);
    return {
      items,
      count: items.length,
      hydrated,
      totals: calculateTotals(subtotal),
      currency: items[0]?.currency ?? 'USD',
      isInCart: (id) => items.some((i) => i._id === String(id)),
      addToCart,
      removeFromCart,
      clearCart,
      syncCart,
      getCartTotal,
      isOpen,
      openCart: () => {
        setAdded(null);
        setIsOpen(true);
      },
      closeCart: () => setIsOpen(false),
      added,
      dismissAdded,
    };
  }, [items, hydrated, isOpen, added, addToCart, removeFromCart, clearCart, syncCart, getCartTotal, dismissAdded]);

  return <CartContext value={value}>{children}</CartContext>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used inside <CartProvider>.');
  return ctx;
}
