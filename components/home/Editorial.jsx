// Small editorial pieces shared by the homepage sections: caps labels, the highlighter stroke, sparkles and glows.

/** Small letter-spaced caps label with a honey square, above section titles. */
export function Eyebrow({ children, className = '', tone = 'text-stone-500' }) {
  return (
    <p className={`flex items-center gap-2 text-xs font-semibold tracking-[0.12em] uppercase ${tone} ${className}`}>
      <span aria-hidden="true" className="size-1.5 bg-brand-500" />
      {children}
    </p>
  );
}

/** A hand-drawn highlighter stroke under a few words (the same mark as the hero's "make things"). */
export function Marker({ children, color = 'text-highlight' }) {
  return (
    <span className="relative isolate inline-block whitespace-nowrap">
      {children}
      <svg aria-hidden="true" viewBox="0 0 300 24" preserveAspectRatio="none" className={`absolute -inset-x-[3%] bottom-[0.04em] -z-10 h-[0.4em] w-[106%] ${color}`}>
        <path d="M4 15C62 8 128 5 190 8s82 6 106 3" fill="none" stroke="currentColor" strokeWidth="16" strokeLinecap="round" />
      </svg>
    </span>
  );
}

/** A small four-point sparkle that twinkles slowly (decorative). Place it with position classes. */
export function Sparkle({ className = '', delay = 0 }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={`pointer-events-none absolute motion-safe:animate-[twinkle_4.5s_ease-in-out_infinite] ${className}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <path d="M12 0c.6 6.6 5.4 11.4 12 12-6.6.6-11.4 5.4-12 12-.6-6.6-5.4-11.4-12-12C6.6 11.4 11.4 6.6 12 0Z" />
    </svg>
  );
}

/** A soft blurred colour glow behind a section's content (decorative). Place, size and colour it with classes. */
export function Glow({ className = '' }) {
  return <span aria-hidden="true" className={`pointer-events-none absolute -z-10 rounded-full blur-3xl ${className}`} />;
}
