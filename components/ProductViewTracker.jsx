'use client';

import { useEffect } from 'react';
import { trackListing } from '@/lib/track';

/** Counts one visit per listing per browser session for the seller's Listing stats (with where it came from). */
export default function ProductViewTracker({ productId }) {
  useEffect(() => {
    const key = `viewed:${productId}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, '1');
    } catch {}
    trackListing(productId, 'visit', document.referrer);
  }, [productId]);
  return null;
}
