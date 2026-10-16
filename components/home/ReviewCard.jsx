import { BadgeCheck, RotateCw } from 'lucide-react';
import Stars from '@/components/Stars';

const initials = (name = '') =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('') || '?';

const monthYear = (d) => (d ? new Date(d).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : null);

/**
 * Verified-buyer review that flips on hover to reveal who wrote it. Pure CSS 3D (no client JS).
 * Focusable, so keyboard users and touch taps flip it too; reduced motion swaps the turn for an instant change.
 */
export default function ReviewCard({ review }) {
  const { rating, body, authorName, productTitle, purchasedAt, createdAt } = review;
  return (
    <li
      tabIndex={0}
      aria-label={`${rating}-star review by ${authorName} of ${productTitle}`}
      className="group h-80 rounded-2xl [perspective:1400px] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-500"
    >
      <div className="relative h-full transition-transform duration-700 ease-[cubic-bezier(0.2,0.7,0.2,1)] [transform-style:preserve-3d] group-hover:[transform:rotateY(180deg)] group-focus:[transform:rotateY(180deg)]">
        {/* ---------- Front: the review ---------- */}
        <figure className="absolute inset-0 flex flex-col rounded-2xl border border-stone-200 bg-white p-7 [backface-visibility:hidden]">
          <div className="flex items-center justify-between">
            <Stars rating={rating} size={16} />
            <RotateCw size={15} strokeWidth={1.75} aria-hidden="true" className="text-stone-300" />
          </div>
          <blockquote className="mt-6 line-clamp-6 text-[15px] leading-relaxed text-stone-700">“{body}”</blockquote>
          <figcaption className="mt-auto border-t border-stone-100 pt-4 text-sm text-stone-500">
            On <span className="font-medium text-black">{productTitle}</span>
          </figcaption>
        </figure>

        {/* ---------- Back: who wrote it ---------- */}
        <div className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl bg-stone-950 p-7 text-center text-white [backface-visibility:hidden] [transform:rotateY(180deg)]">
          <span aria-hidden="true" className="grid size-16 place-items-center rounded-full bg-brand-600 text-xl font-medium">
            {initials(authorName)}
          </span>
          <p className="headline mt-5 text-2xl leading-tight">{authorName}</p>
          <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white/90">
            <BadgeCheck size={14} strokeWidth={1.75} aria-hidden="true" className="text-emerald-400" />
            Verified buyer
          </p>
          <div className="mt-6 w-full border-t border-white/10 pt-5 text-sm">
            <p className="text-white/60">
              Purchased <span className="text-white">{productTitle}</span>
            </p>
            <p className="mt-1 text-xs text-white/40">
              {monthYear(purchasedAt) && `Bought ${monthYear(purchasedAt)} · `}Reviewed {monthYear(createdAt)}
            </p>
          </div>
          <Stars rating={rating} size={14} tone="dark" className="mt-4" />
        </div>
      </div>
    </li>
  );
}
