import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import Reveal from '@/components/Reveal';
import SectionHeading from '@/components/home/SectionHeading';

const STEPS = [
  { title: 'Find it', text: 'Search or browse by category. Not sure it fits? Message the seller before you buy.' },
  { title: 'Pay once', text: 'Check out in a minute: one price, no subscription, and your card details are never stored.' },
  { title: 'Download instantly', text: 'Your files are ready the moment payment clears, and they stay in your library.' },
];

/** Three numbered steps in quiet columns: a thin rule, a large serif number, the title and one line of text. */
export default function HowItWorks() {
  return (
    <section className="container-page pt-24 sm:pt-32" aria-labelledby="how-heading">
      <SectionHeading id="how-heading" eyebrow="How it works" title="From browsing to downloading in three steps">
        <Link href="/how-it-works" className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-600 hover:text-ink">
          Read the full guide
          <ArrowRight size={15} strokeWidth={1.75} aria-hidden="true" />
        </Link>
      </SectionHeading>
      <ol className="mt-12 grid gap-10 md:grid-cols-3 md:gap-8">
        {STEPS.map(({ title, text }, i) => (
          <Reveal as="li" key={title} delay={i * 120} className="relative border-t border-stone-300 pt-6 before:absolute before:-top-[5px] before:left-0 before:size-2.5 before:rounded-full before:bg-brand-500">
            <span className="font-serif text-5xl leading-none tracking-[-0.03em] text-brand-600 tabular-nums">{String(i + 1).padStart(2, '0')}</span>
            <p className="mt-6 font-serif text-[1.6rem] leading-tight tracking-[-0.02em] text-ink">{title}</p>
            <p className="mt-2 max-w-sm text-[15px] leading-relaxed text-stone-600">{text}</p>
          </Reveal>
        ))}
      </ol>
    </section>
  );
}
