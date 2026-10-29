'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

/** Page offset where the bar detaches: the hero's bottom (pages with [data-hero]), otherwise a short scroll. */
function detachPoint(header) {
  const hero = document.querySelector('[data-hero]');
  if (!hero) return 80;
  return hero.getBoundingClientRect().bottom + window.scrollY - header.offsetHeight;
}

/**
 * Sticky storefront header that changes shape with the page: flush, full-width bar over the hero (or the top of any
 * page), then — once you scroll past it — a floating pill that drops away from the top edge, narrows and rounds off;
 * scrolling back up docks it again. Only transforms and box styles change, never the header's height, so the page
 * below never jumps. Dropdowns (Shop, search, account, mobile menu) keep working because nothing is clipped.
 */
export default function FloatingHeader({ children }) {
  const pathname = usePathname();
  const [floating, setFloating] = useState(false);

  useEffect(() => {
    const header = document.getElementById('site-header');
    if (!header) return undefined;
    let frame = 0;
    let point = detachPoint(header);
    const update = () => {
      frame = 0;
      // A little hysteresis so it doesn't flicker when you stop right at the edge.
      setFloating((was) => (was ? window.scrollY > point - 12 : window.scrollY > point));
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    const onResize = () => {
      point = detachPoint(header);
      onScroll();
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
    };
  }, [pathname]);

  return (
    <header id="site-header" data-floating={floating || undefined} className="group/header sticky top-0 z-40">
      <div
        className={`mx-auto transition-[translate,width,max-width,border-radius,background-color,box-shadow,border-color] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          floating
            ? 'w-[calc(100%-1.5rem)] max-w-6xl translate-y-3 rounded-[2rem] border border-stone-200/90 bg-paper/80 shadow-lift backdrop-blur-md supports-[backdrop-filter]:bg-paper/70'
            : 'w-full max-w-full translate-y-0 rounded-none border border-transparent border-b-stone-200/80 bg-paper/95 backdrop-blur supports-[backdrop-filter]:bg-paper/85'
        }`}
      >
        {children}
      </div>
    </header>
  );
}
