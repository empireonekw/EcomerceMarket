import Link from 'next/link';
import { ArrowRight, Clock } from 'lucide-react';
import { Avatar } from '@/components/admin/ui';
import { countryName } from '@/lib/site-stats';

const ago = (date) => {
  if (!date) return 'Date unknown';
  const days = Math.floor((Date.now() - new Date(date)) / 86_400_000);
  if (days <= 0) return 'Sent today';
  if (days === 1) return 'Sent yesterday';
  return `Sent ${days} days ago`;
};

/**
 * A preview of one ID file. A background image, not <img>: a file that can't be opened (e.g. on a developer's
 * machine, where uploads aren't stored) leaves the soft placeholder instead of a broken-image icon.
 */
function DocPreview({ userId, side, label, round = false }) {
  return (
    <span
      role="img"
      aria-label={label}
      className={`block bg-stone-100 bg-cover bg-center ${round ? 'size-full rounded-xl' : 'size-full rounded-xl'}`}
      style={{ backgroundImage: `url(/api/admin/users/${userId}/id-document/${side})` }}
    />
  );
}

/**
 * Admin → Users → ID check "To review": the sellers waiting for an identity check, oldest first, as cards with
 * their ID front and selfie, so the queue reads at a glance. Each opens the user page, where the review happens.
 */
export default function IdReviewQueue({ items }) {
  return (
    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((u, i) => (
        <li
          key={u.id}
          className="group relative flex flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white transition-colors hover:border-stone-300"
        >
          <div className="grid h-40 grid-cols-[1.6fr_1fr] gap-2 bg-stone-50 p-2">
            <DocPreview userId={u.id} side="front" label={`${u.name}: ID front`} />
            <DocPreview userId={u.id} side="selfie" label={`${u.name}: selfie`} round />
          </div>
          <div className="flex flex-1 flex-col p-4">
            <div className="flex items-center gap-3">
              <Avatar name={u.name} size="sm" />
              <div className="min-w-0">
                <Link href={`/admin/users/${u.id}#identity`} className="block truncate text-sm font-semibold text-ink after:absolute after:inset-0">
                  {u.name}
                </Link>
                <p className="truncate text-xs text-stone-500">
                  {u.selling?.storeName ?? u.email}
                  {u.selling?.country && ` · ${countryName(u.selling.country)}`}
                </p>
              </div>
              {i === 0 && <span className="ml-auto shrink-0 rounded-full bg-brand-500 px-2 py-0.5 text-xs font-semibold text-ink">Next</span>}
            </div>
            <div className="mt-4 flex items-center justify-between gap-2 border-t border-stone-100 pt-3 text-xs">
              <span className="flex items-center gap-1.5 text-stone-500">
                <Clock size={13} strokeWidth={2} aria-hidden="true" />
                {ago(u.selling?.verificationSubmittedAt)}
              </span>
              <span className="flex items-center gap-1 font-semibold text-ink">
                Review ID
                <ArrowRight size={14} strokeWidth={2} aria-hidden="true" className="transition-transform group-hover:translate-x-0.5" />
              </span>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
