'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Fades and lifts its content in when it scrolls into view (`delay` in ms staggers siblings). Server-rendered visible,
 * and only hidden after mount while still below the fold, so nothing depends on JS to be seen, nothing already on
 * screen ever blinks, and "reduce motion" leaves everything static. Styles: .reveal-hidden / .reveal-shown (globals.css).
 */
export default function Reveal({ as: Tag = 'div', delay = 0, className = '', style, children, ...rest }) {
  const ref = useRef(null);
  const [state, setState] = useState('static'); // static → hidden → shown

  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (el.getBoundingClientRect().top < window.innerHeight * 0.9) return; // already on screen: leave it alone
    setState('hidden');
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setState('shown');
        io.disconnect();
      },
      { rootMargin: '0px 0px -10% 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const motion = state === 'hidden' ? 'reveal-hidden' : state === 'shown' ? 'reveal-shown' : '';
  return (
    <Tag ref={ref} className={`${className} ${motion}`} style={{ ...style, '--reveal-delay': `${delay}ms` }} {...rest}>
      {children}
    </Tag>
  );
}
