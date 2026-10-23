import { BadgeCheck, Download, FileStack, Library, Lock, ShieldCheck, Users, Wallet } from 'lucide-react';
import { commissionPercent, COMMISSION_RATE } from '@/lib/commission';

// Only promises the platform actually keeps (delivery, moderation, checkout, files, payouts).
const FEATURES = [
  { icon: Download, title: 'Instant Download', text: 'Your files are ready the moment payment clears.' },
  { icon: BadgeCheck, title: 'Premium Quality Products', text: 'Every product is reviewed by our team before it goes live.' },
  { icon: Lock, title: 'Secure Checkout', text: 'Encrypted payments — we never store your card details.' },
  { icon: Wallet, title: 'Pay Once, Keep It', text: 'No subscriptions. One price, and the files are yours.' },
  { icon: Library, title: 'Your Personal Library', text: 'Every purchase stays in your account, ready to re-download.' },
  { icon: ShieldCheck, title: 'Protected Files', text: 'Signed, expiring download links keep every file safe.' },
  { icon: Users, title: 'Independent Creators', text: `Buy from the people who make it — they keep ${commissionPercent(1 - COMMISSION_RATE)}.` },
  { icon: FileStack, title: 'Ready-to-Use Formats', text: 'PDF, Figma, Notion, ZIP and more — open and start working.' },
];

/**
 * Full-width benefits strip between "Shop by category" and "Latest products": icon-in-circle cards with thin
 * dividers, scrolling right → left.
 * Pure CSS (no client JS): the list is rendered twice and the track moves -50% per loop (marquee-x in
 * globals.css). Pauses on hover and keyboard focus; never moves under "reduce motion".
 */
export default function FeatureMarquee() {
  return (
    <section aria-labelledby="features-heading" className="group/features mt-20 overflow-hidden border-y border-stone-200 bg-stone-50 py-10 sm:mt-28 sm:py-12">
      <div className="mb-8 flex justify-center px-4">
        <h2
          id="features-heading"
          className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white px-4 py-2 text-sm font-medium text-stone-700"
        >
          <span aria-hidden="true" className="size-1.5 rounded-full bg-brand-600" />
          Why shop with us
        </h2>
      </div>

      <div
        className="flex w-max motion-safe:animate-marquee-x group-hover/features:[animation-play-state:paused]! group-focus-within/features:[animation-play-state:paused]!"
        style={{ animationDuration: '70s' }}
      >
        {[0, 1].map((copy) => (
          // The second copy only closes the loop: hidden from assistive tech.
          <ul key={copy} aria-hidden={copy === 1 || undefined} className="flex shrink-0">
            {FEATURES.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex w-72 shrink-0 flex-col items-center border-r border-stone-200 px-8 text-center sm:w-80">
                <span className="grid size-12 place-items-center rounded-full border border-stone-200 bg-white text-stone-800">
                  <Icon size={20} strokeWidth={1.75} aria-hidden="true" />
                </span>
                <h3 className="mt-4 font-medium text-black">{title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-stone-500 text-balance">{text}</p>
              </li>
            ))}
          </ul>
        ))}
      </div>
    </section>
  );
}
