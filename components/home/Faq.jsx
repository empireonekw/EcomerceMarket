import Link from 'next/link';
import { Plus } from 'lucide-react';
import { Eyebrow, Glow, Sparkle } from '@/components/home/Editorial';
import { commissionPercent, COMMISSION_RATE, NO_PLATFORM_FEE } from '@/lib/commission';
import Reveal from '@/components/Reveal';

// Answers follow the published policies (lib/policies.js): delivery, formats, refunds, checkout and selling.
const QUESTIONS = [
  {
    q: 'How do I get my files after paying?',
    a: 'Instantly. Your download is ready the moment payment clears, and every purchase is saved under My Purchases in your account, so you can re-download it any time.',
  },
  {
    q: 'What formats will I get?',
    a: 'Each product page lists exactly what you get, usually a PDF or ZIP download, or a link to a Canva, Notion, Figma or Google Sheets copy you can use straight away.',
  },
  {
    q: 'Can I get a refund?',
    a: (
      <>
        Digital files can’t be returned, so sales are generally final, but if a file is faulty, can’t be downloaded or is materially different from its description, you get a full refund.
        Contact us within 14 days of your purchase. Details are in our{' '}
        <Link href="/legal/refund-policy" className="font-medium text-ink underline underline-offset-4 hover:text-brand-700">
          refund policy
        </Link>
        .
      </>
    ),
  },
  { q: 'Is checkout secure?', a: 'Yes. Payments are encrypted and handled by the payment provider. We never store your card details.' },
  {
    q: 'Can I ask the seller something before buying?',
    a: 'Yes. Every shop has a direct line: open any product and choose “Message seller” to ask about formats, licences or a custom version.',
  },
  {
    q: 'How do I start selling?',
    a: `Create a seller account, name your shop and add your first listing. Our team reviews it before it goes live. ${
      NO_PLATFORM_FEE ? 'You keep 100% of every sale' : `You keep ${commissionPercent(1 - COMMISSION_RATE)} of every sale`
    }, paid out to your bank account or mobile wallet.`,
  },
];

/** Questions, answered: a sticky heading beside native <details> rows (no client JS; keyboard and screen-reader friendly). */
export default function Faq() {
  return (
    <section className="container-page relative isolate pt-24 sm:pt-32" aria-labelledby="faq-heading">
      <Glow className="top-32 left-16 size-64 bg-peach-100/70" />
      <Sparkle className="top-28 left-[26%] hidden size-5 text-brand-500 lg:block" />
      <div className="grid gap-10 lg:grid-cols-[minmax(0,22rem)_1fr] lg:gap-20">
        <Reveal className="lg:sticky lg:top-28 lg:self-start">
          <Eyebrow>FAQ</Eyebrow>
          <h2 id="faq-heading" className="mt-4 font-serif text-[2.25rem] leading-[1.05] tracking-[-0.025em] text-ink sm:text-[3rem]">
            Questions, answered
          </h2>
          <p className="mt-4 text-stone-600">
            Something else?{' '}
            <Link href="/contact" className="font-medium text-ink underline underline-offset-4 hover:text-brand-700">
              Contact us
            </Link>
            . We reply within 1–2 business days.
          </p>
        </Reveal>
        <Reveal delay={120} className="divide-y divide-stone-200 border-y border-stone-200">
          {QUESTIONS.map(({ q, a }, i) => (
            <details key={q} name="home-faq" open={i === 0} className="faq-item group">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-5 text-left text-lg font-medium text-ink marker:hidden [&::-webkit-details-marker]:hidden">
                {q}
                <span className="grid size-8 shrink-0 place-items-center rounded-full border border-stone-300 transition group-open:rotate-45 group-open:border-ink group-open:bg-ink group-open:text-white">
                  <Plus size={16} strokeWidth={2} aria-hidden="true" />
                </span>
              </summary>
              <p className="faq-answer max-w-2xl pb-6 pr-14 leading-relaxed text-stone-600">{a}</p>
            </details>
          ))}
        </Reveal>
      </div>
    </section>
  );
}
