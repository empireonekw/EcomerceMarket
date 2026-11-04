'use client';

import { useEffect, useState } from 'react';
import { ArrowUp } from 'lucide-react';

/** Round "↑" button, bottom-right, once the shopper has scrolled well down a page. */
export default function BackToTop() {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const onScroll = () => setShown(window.scrollY > 900);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })}
      aria-label="Back to top"
      tabIndex={shown ? 0 : -1}
      className={`fixed right-4 bottom-4 z-30 grid size-11 place-items-center rounded-full border border-stone-200 bg-white text-ink shadow-lg transition duration-300 hover:border-ink sm:right-6 sm:bottom-6 ${
        shown ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-3 opacity-0'
      }`}
    >
      <ArrowUp size={18} strokeWidth={2} aria-hidden="true" />
    </button>
  );
}
