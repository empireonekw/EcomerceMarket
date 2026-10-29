import { BadgeCheck, Check, Download, FileText, Library, Lock, ShieldCheck, Wallet } from 'lucide-react';
import Reveal from '@/components/Reveal';
import { Eyebrow, Sparkle } from '@/components/home/Editorial';

// Only promises the platform actually keeps (moderation, checkout, one-time pricing, the buyer's library).
const ITEMS = [
  { id: 'reviewed', icon: BadgeCheck, tint: 'bg-brand-50', title: 'Reviewed before it’s listed', text: 'Every product is checked by our team before it goes live: files, previews and description.' },
  { id: 'checkout', icon: Lock, tint: 'bg-peach-50', title: 'Secure checkout', text: 'Encrypted payments. We never store your card details.' },
  { id: 'once', icon: Wallet, tint: 'bg-berry-50', title: 'Pay once, keep it', text: 'No subscriptions. One price, and the files are yours.' },
  { id: 'library', icon: Library, tint: 'bg-stone-100', title: 'Your personal library', text: 'Every purchase stays in your account, ready to re-download whenever you need it.' },
];

function Row({ children, done = true }) {
  return (
    <li className="flex items-center gap-3 rounded-xl border border-stone-100 bg-stone-50/70 px-3.5 py-2.5 text-sm">
      <span className={`grid size-5 shrink-0 place-items-center rounded-full ${done ? 'bg-brand-500 text-ink' : 'border border-stone-300'}`}>
        {done && <Check size={12} strokeWidth={3} aria-hidden="true" />}
      </span>
      {children}
    </li>
  );
}

/** Illustrative product UI for each benefit (decorative: the card text says the same thing). */
function Mockup({ id }) {
  if (id === 'reviewed')
    return (
      <>
        <div className="flex items-center justify-between">
          <p className="font-medium">Listing review</p>
          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">Approved · Live</span>
        </div>
        <ul className="mt-5 space-y-2">
          <Row>Files open and download correctly</Row>
          <Row>Preview images match the files</Row>
          <Row>Description and formats are clear</Row>
          <Row>Licence terms are stated</Row>
        </ul>
      </>
    );
  if (id === 'checkout')
    return (
      <>
        <div className="flex items-center justify-between">
          <p className="font-medium">Checkout</p>
          <span className="inline-flex items-center gap-1.5 text-xs text-stone-500">
            <ShieldCheck size={14} strokeWidth={1.75} aria-hidden="true" className="text-emerald-600" />
            Encrypted
          </span>
        </div>
        <div className="mt-5 space-y-2 text-sm">
          <div className="flex justify-between rounded-xl bg-stone-50/70 px-3.5 py-2.5">
            <span>Notion Budget Planner</span>
            <span className="tabular-nums">$9.00</span>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-stone-200 px-3.5 py-2.5 text-stone-500">
            <Lock size={14} strokeWidth={1.75} aria-hidden="true" />
            Card details go straight to the payment provider
          </div>
        </div>
        <div className="mt-5 flex items-center justify-between border-t border-stone-100 pt-4">
          <span className="text-sm text-stone-500">Total</span>
          <span className="font-serif text-2xl tabular-nums">$9.00</span>
        </div>
        <div className="mt-4 rounded-full bg-brand-500 py-2.5 text-center text-sm font-medium text-ink">Pay securely</div>
      </>
    );
  if (id === 'once')
    return (
      <>
        <p className="text-xs font-semibold tracking-[0.12em] text-stone-500 uppercase">Receipt</p>
        <p className="mt-2 font-serif text-2xl">Line Icons Pro</p>
        <dl className="mt-5 space-y-2 text-sm">
          {[
            ['Price', '$39.00'],
            ['Billing', 'One-time'],
            ['Renewal', 'None'],
            ['Access', 'Forever'],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between border-b border-dashed border-stone-200 pb-2">
              <dt className="text-stone-500">{k}</dt>
              <dd className="font-medium tabular-nums">{v}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-5 inline-flex rounded-full bg-peach-50 px-3 py-1 text-xs font-medium text-peach-700">No subscription. It’s yours</p>
      </>
    );
  return (
    <>
      <div className="flex items-center justify-between">
        <p className="font-medium">My purchases</p>
        <span className="rounded-full bg-brand-100 px-2 py-0.5 text-xs font-semibold text-brand-800">3</span>
      </div>
      <ul className="mt-5 space-y-2">
        {['Notion Budget Planner', 'Line Icons Pro', 'Abstract Shapes Pack'].map((t) => (
          <li key={t} className="flex items-center gap-3 rounded-xl border border-stone-100 bg-stone-50/70 px-3 py-2.5 text-sm">
            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-white text-stone-500 ring-1 ring-stone-200">
              <FileText size={15} strokeWidth={1.75} aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1 truncate">{t}</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-brand-500 px-2.5 py-1 text-xs font-medium text-ink">
              <Download size={12} strokeWidth={2.25} aria-hidden="true" />
              Download
            </span>
          </li>
        ))}
      </ul>
    </>
  );
}

/**
 * "Why shop with us" as a stack of cards: each benefit is a large card (text left, an illustrative mockup on a soft
 * tinted panel right). On large screens every card pins near the top as you scroll and the next one slides up over
 * it, so they pile up like a deck (CSS position: sticky, no JS). On phones they simply follow one another.
 */
export default function WhyShop() {
  return (
    <section aria-labelledby="why-heading" className="relative isolate mt-24 overflow-x-clip border-y border-stone-200 bg-canvas py-20 sm:mt-32 sm:py-28">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-80 [mask-image:linear-gradient(to_bottom,#000,transparent)]"
        style={{ backgroundImage: 'linear-gradient(to right, rgb(20 20 20 / 0.05) 1px, transparent 1px), linear-gradient(to bottom, rgb(20 20 20 / 0.05) 1px, transparent 1px)', backgroundSize: '48px 48px' }}
      />
      <Sparkle className="top-24 left-[16%] hidden size-5 text-brand-500 md:block" />
      <Sparkle delay={2000} className="top-36 right-[17%] hidden size-4 text-peach-500 md:block" />
      <div className="container-page">        <Reveal className="mx-auto max-w-2xl text-center">
          <Eyebrow className="justify-center">Why shop with us</Eyebrow>
          <h2 id="why-heading" className="mt-4 font-serif text-[2.25rem] leading-[1.05] tracking-[-0.025em] text-ink text-balance sm:text-[3rem]">
            Buying digital goods, without the guesswork
          </h2>
        </Reveal>

        <ol className="mt-14 space-y-5 lg:space-y-0">
          {ITEMS.map(({ id, icon: Icon, tint, title, text }, i) => (
            // Each card pins a little lower than the one before, so the edges of the stack stay visible.
            <li key={id} className="lg:sticky lg:pb-12" style={{ top: `calc(6.5rem + ${i * 1.5}rem)` }}>
              <article className="grid overflow-hidden rounded-[2rem] border border-stone-200 bg-white shadow-[0_-12px_40px_-28px_rgba(20,20,20,0.3)] lg:min-h-[25rem] lg:grid-cols-2">
                <div className="flex flex-col p-7 sm:p-10 lg:p-12">
                  <span className="flex items-center justify-between">
                    <span className="grid size-11 place-items-center rounded-full bg-brand-50 text-brand-700">
                      <Icon size={20} strokeWidth={1.75} aria-hidden="true" />
                    </span>
                    <span className="text-sm text-stone-400 tabular-nums">
                      {String(i + 1).padStart(2, '0')} / {String(ITEMS.length).padStart(2, '0')}
                    </span>
                  </span>
                  <h3 className="mt-10 font-serif text-[1.9rem] leading-[1.1] tracking-[-0.02em] text-ink sm:text-[2.4rem] lg:mt-auto">{title}</h3>
                  <p className="mt-3 max-w-md text-lg leading-relaxed text-stone-600">{text}</p>
                </div>
                <div aria-hidden="true" className={`flex items-center justify-center p-6 sm:p-10 ${tint}`}>
                  <div className="w-full max-w-sm rounded-3xl border border-stone-200 bg-white p-6 shadow-[0_24px_50px_-30px_rgba(20,20,20,0.35)]">
                    <Mockup id={id} />
                  </div>
                </div>
              </article>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
