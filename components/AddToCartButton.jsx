'use client';

import { Check, Plus } from 'lucide-react';
import { useCart } from '@/context/CartContext';

/**
 * `product` only needs { _id, slug, title, price, currency, coverImage }. Opens the cart drawer on add.
 * `compact` = the small "Add" pill used on product cards; otherwise a full-width large button.
 */
export default function AddToCartButton({ product, compact = false, className = '' }) {
  const { isInCart, addToCart, openCart } = useCart();
  const inCart = isInCart(product._id);
  const base = `btn ${compact ? 'btn-sm px-3.5' : 'btn-lg w-full'} ${className}`;
  const icon = { size: compact ? 15 : 17, strokeWidth: 2, 'aria-hidden': true };

  if (inCart) {
    return (
      <button
        type="button"
        onClick={openCart}
        aria-label={compact ? `${product.title} is in your cart — view cart` : undefined}
        className={`${base} btn-soft`}
      >
        <Check {...icon} className="text-emerald-600" />
        {compact ? 'In cart' : 'In cart — view'}
      </button>
    );
  }

  const label = product.price === 0 ? 'Add free item' : 'Add to cart';
  return (
    <button
      type="button"
      onClick={() => addToCart(product)}
      aria-label={compact ? `${label}: ${product.title}` : undefined}
      className={`${base} ${compact ? 'btn-dark' : 'btn-outline'}`}
    >
      {compact && <Plus {...icon} />}
      {compact ? 'Add' : label}
    </button>
  );
}
