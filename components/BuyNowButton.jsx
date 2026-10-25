'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useCart } from '@/context/CartContext';

/** Adds the product (without opening the drawer) and goes straight to checkout. */
export default function BuyNowButton({ product, className = '' }) {
  const router = useRouter();
  const { addToCart } = useCart();

  // Warm the checkout route so the transition is instant.
  useEffect(() => {
    router.prefetch('/checkout');
  }, [router]);

  return (
    <button
      type="button"
      onClick={() => {
        addToCart(product, { notify: false });
        router.push('/checkout');
      }}
      className={`btn btn-lg btn-primary w-full ${className}`}
    >
      {product.price === 0 ? 'Get it free now' : 'Buy now'}
      <svg aria-hidden="true" viewBox="0 0 20 20" className="size-4" fill="currentColor">
        <path d="M11.3 4.3a1 1 0 0 1 1.4 0l5 5a1 1 0 0 1 0 1.4l-5 5a1 1 0 0 1-1.4-1.4l3.3-3.3H3a1 1 0 1 1 0-2h11.6l-3.3-3.3a1 1 0 0 1 0-1.4Z" />
      </svg>
    </button>
  );
}
