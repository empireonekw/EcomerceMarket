'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useCart } from '@/context/CartContext';

/** While PayFast hasn't confirmed yet: re-checks the order every few seconds (for up to two minutes). */
export function RefreshWhilePending({ everyMs = 3000, forMs = 120000 }) {
  const router = useRouter();
  useEffect(() => {
    const started = Date.now();
    const id = setInterval(() => {
      if (Date.now() - started > forMs) clearInterval(id);
      else router.refresh();
    }, everyMs);
    return () => clearInterval(id);
  }, [router, everyMs, forMs]);
  return null;
}

/** Set by the checkout just before it hands the buyer to PayFast (sessionStorage survives the round trip). */
export const PENDING_ORDER_KEY = 'payfast-pending-order';

/**
 * On a paid receipt: the cart was kept while the buyer was on PayFast; empty it now that this order went through.
 * Only for the order this tab just paid, so reopening an old receipt later never empties a new cart.
 */
export function ClearCartWhenPaid({ orderId }) {
  const { clearCart, hydrated } = useCart();
  useEffect(() => {
    if (!hydrated) return;
    try {
      if (sessionStorage.getItem(PENDING_ORDER_KEY) !== orderId) return;
      sessionStorage.removeItem(PENDING_ORDER_KEY);
    } catch {
      return;
    }
    clearCart();
  }, [hydrated, clearCart, orderId]);
  return null;
}
