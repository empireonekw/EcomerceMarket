'use client';

import { useEffect, useRef, useState } from 'react';

const DURATION = 1200;
const easeOut = (t) => 1 - (1 - t) ** 3;

/**
 * A number that counts up from 0 when it scrolls into view. Server-rendered at its final value (correct without JS
 * and for search engines); only reset to 0 after mount while still off screen. Static under "reduce motion".
 */
export default function CountUp({ value, suffix = '', className = '' }) {
  const ref = useRef(null);
  const [shown, setShown] = useState(value);

  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (el.getBoundingClientRect().top < window.innerHeight * 0.85) return; // already on screen
    setShown(0);
    let frame;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        io.disconnect();
        const start = performance.now();
        const tick = (now) => {
          const t = Math.min(1, (now - start) / DURATION);
          setShown(Math.round(easeOut(t) * value));
          if (t < 1) frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
      },
      { threshold: 0.25 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [value]);

  return (
    <span ref={ref} className={className}>
      {/* Screen readers get the real value once, not every frame of the count. */}
      <span className="sr-only">
        {value}
        {suffix}
      </span>
      <span aria-hidden="true">
        {shown}
        {suffix}
      </span>
    </span>
  );
}
