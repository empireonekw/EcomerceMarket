'use client';

import { Check, Plus } from 'lucide-react';
import { useCart } from '@/context/CartContext';

/**
 * `product` only needs { _id, slug, title, price, currency, coverImage }. Adding shows the "Added to your cart"
 * notice under the navbar (components/CartToast.jsx); once in the cart, the button opens the cart drawer.
 * `compact` = the small "Add" pill; `outlined` = the product card's "+ Add to cart" outline pill (just "Add" on a narrow
 * card); otherwise a full-width large button.
 */
export default function AddToCartButton({ product, compact = false, outlined = false, className = '' }) {
  if (outlined) return <OutlinedButton product={product} className={className} />;
  const { isInCart, addToCart, openCart } = useCart();
  const inCart = isInCart(product._id);
  const base = `btn ${compact ? 'btn-sm px-3.5' : 'btn-lg w-full'} ${className}`;
  const icon = { size: compact ? 15 : 17, strokeWidth: 2, 'aria-hidden': true };

  if (inCart) {
    return (
      <button
        type="button"
        onClick={openCart}
        aria-label={compact ? `${product.title} is in your cart. View cart` : undefined}
        className={`${base} btn-soft`}
      >
        <Check {...icon} className="text-emerald-600" />
        {compact ? 'In cart' : 'In cart · View'}
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

/** Product card: "+ Add to cart" outline pill ("+ Add" when the card is narrow, via its @container). */
function OutlinedButton({ product, className }) {
  const { isInCart, addToCart, openCart } = useCart();
  const base = `inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border px-4 text-sm font-semibold transition-colors ${className}`;
  if (isInCart(product._id)) {
    return (
      <button type="button" onClick={openCart} aria-label={`${product.title} is in your cart. View cart`} className={`${base} border-stone-200 bg-stone-100 text-ink`}>
        <Check size={16} strokeWidth={2.25} aria-hidden="true" className="text-emerald-600" />
        In cart
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={() => addToCart(product)}
      aria-label={`${product.price === 0 ? 'Add free item' : 'Add to cart'}: ${product.title}`}
      className={`${base} border-ink text-ink hover:bg-ink hover:text-white`}
    >
      <Plus size={16} strokeWidth={2.25} aria-hidden="true" />
      Add<span className="hidden @[17rem]:inline"> to cart</span>
    </button>
  );
}
