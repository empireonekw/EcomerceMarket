import { Star } from 'lucide-react';

/** Read-only star rating (server-safe). `tone="dark"` for dark backgrounds. */
export default function Stars({ rating, size = 15, tone = 'light', className = '' }) {
  const empty = tone === 'dark' ? 'fill-white/15 text-white/15' : 'fill-stone-200 text-stone-200';
  return (
    <span className={`inline-flex gap-0.5 ${className}`} role="img" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} size={size} strokeWidth={1.5} aria-hidden="true" className={n <= Math.round(rating) ? 'fill-amber-400 text-amber-400' : empty} />
      ))}
    </span>
  );
}
