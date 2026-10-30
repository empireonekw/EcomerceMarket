'use client';

import { useEffect } from 'react';
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

const clearPending = () => {
  document.querySelectorAll('[data-pending]').forEach((el) => el.removeAttribute('data-pending'));
  document.documentElement.removeAttribute('data-navigating');
};

/**
 * Feedback on the thing that was clicked while the next page loads: the clicked link (or a GET form's submit button)
 * gets data-pending, and globals.css draws a small spinner inside buttons and menu rows (`.btn`, flex links) and a
 * progress cursor everywhere. Cleared as soon as the new URL is on screen.
 */
export default function NavigationProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    let timer;
    const mark = (el) => {
      clearPending();
      clearTimeout(timer);
      el?.setAttribute('data-pending', '');
      document.documentElement.setAttribute('data-navigating', '');
      timer = setTimeout(clearPending, 15000); // never stuck
    };
    const onClick = (e) => {
      const a = e.target.closest?.('a[href]');
      if (!a || !isPlainClick(e) || (a.target && a.target !== '_self') || a.hasAttribute('download')) return;
      if (a.getAttribute('aria-current') === 'page') return;
      if (internalTarget(a.href)) mark(a);
    };
    const onSubmit = (e) => {
      const form = e.target;
      if (!(form instanceof HTMLFormElement) || (form.method || 'get').toLowerCase() !== 'get') return;
      const url = new URL(form.action, location.href);
      url.search = new URLSearchParams(new FormData(form, e.submitter)).toString();
      if (internalTarget(url.href)) mark(e.submitter ?? form.querySelector('button[type=submit], button:not([type])'));
    };
    document.addEventListener('click', onClick);
    document.addEventListener('submit', onSubmit);
    window.addEventListener('pageshow', clearPending);
    return () => {
      document.removeEventListener('click', onClick);
      document.removeEventListener('submit', onSubmit);
      window.removeEventListener('pageshow', clearPending);
      clearTimeout(timer);
    };
  }, []);

  // The new page is here.
  useEffect(clearPending, [pathname, searchParams]);

  return null;
}
