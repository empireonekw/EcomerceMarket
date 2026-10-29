'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

const isPlainClick = (e) => e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;

/** The URL a click or form submission would navigate to inside this app, or null (new tab, other site, same page…). */
function internalTarget(href) {
  let url;
  try {
    url = new URL(href, location.href);
  } catch {
    return null;
  }
  if (url.origin !== location.origin || /^\/(api|_next)\//.test(url.pathname)) return null;
  const here = new URL(location.href);
  // Only a #hash change: no page load to wait for.
  if (url.pathname === here.pathname && url.search === here.search) return null;
  return url;
}

/**
 * A thin brand-yellow bar at the top of the page from the moment a link is clicked (or a search/filter form is sent)
 * until the new page is on screen, so a click never looks like nothing happened while the server renders the page.
 */
export default function NavigationProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [progress, setProgress] = useState(null); // null = hidden, 0–100 = shown
  const timers = useRef([]);
  const running = useRef(false);

  const clear = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };
  const hide = () => {
    running.current = false;
    setProgress(null);
  };

  useEffect(() => {
    const start = () => {
      clear();
      running.current = true;
      setProgress(12);
      // Creep towards 90% while waiting; it only completes when the new page arrives.
      const tick = (value) => {
        timers.current.push(
          setTimeout(() => {
            setProgress((p) => (p == null ? p : Math.max(p, value)));
            if (value < 90) tick(value + (90 - value) * 0.25);
          }, 250),
        );
      };
      tick(30);
      timers.current.push(setTimeout(hide, 15000)); // never stuck on screen
    };
    const onClick = (e) => {
      const a = e.target.closest?.('a[href]');
      if (!a || !isPlainClick(e) || (a.target && a.target !== '_self') || a.hasAttribute('download')) return;
      if (internalTarget(a.href)) start();
    };
    const onSubmit = (e) => {
      const form = e.target;
      if (!(form instanceof HTMLFormElement) || (form.method || 'get').toLowerCase() !== 'get') return;
      if (internalTarget(form.action)) start();
    };
    document.addEventListener('click', onClick, true);
    document.addEventListener('submit', onSubmit, true);
    return () => {
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('submit', onSubmit, true);
      clear();
    };
  }, []);

  // The new page is here: fill the bar, then fade it out.
  useEffect(() => {
    if (!running.current) return;
    clear();
    setProgress(100);
    timers.current.push(setTimeout(hide, 300));
  }, [pathname, searchParams]);

  if (progress == null) return null;
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-[3px]">
      <div
        className={`h-full rounded-r-full bg-brand-500 shadow-[0_0_10px_rgba(237,174,73,0.9)] transition-[width,opacity] duration-300 ease-out ${progress === 100 ? 'opacity-0 delay-150' : 'opacity-100'}`}
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}
