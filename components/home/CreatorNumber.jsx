import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Eyebrow, Glow, Sparkle } from '@/components/home/Editorial';
import { COMMISSION_RATE, NO_PLATFORM_FEE } from '@/lib/commission';
import Reveal from '@/components/Reveal';
import CountUp from '@/components/home/CountUp';

/**
 * For creators: one giant number, the share of every sale a seller keeps, over a faint dot grid. The number counts
 * up when it scrolls into view and its honey → peach → berry gradient drifts slowly; the dots drift too. Below it,
 * the call to start selling.
 */
export default function CreatorNumber() {
  const keep = NO_PLATFORM_FEE ? 100 : Math.round((1 - COMMISSION_RATE) * 1000) / 10;
  return (
    <section aria-labelledby="creators-heading" className="relative isolate mt-24 overflow-x-clip py-20 sm:mt-32 sm:py-28">
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 motion-safe:animate-[dots-drift_24s_linear_infinite] [mask-image:radial-gradient(ellipse_60%_65%_at_50%_45%,#000_35%,transparent_100%)]"
        style={{ backgroundImage: 'radial-gradient(circle, rgb(20 20 20 / 0.1) 1px, transparent 1.2px)', backgroundSize: '22px 22px' }}
      />

      <Glow className="top-16 left-1/2 size-[30rem] -translate-x-1/2 bg-brand-100/80 sm:size-[38rem]" />
      <Sparkle className="top-[22%] left-[22%] hidden size-6 text-brand-500 md:block" />
      <Sparkle delay={1800} className="top-[34%] right-[22%] hidden size-4 text-berry-500 md:block" />
      <Reveal className="container-page text-center">
        <Eyebrow className="justify-center">For creators</Eyebrow>
        <p className="mt-6 text-sm text-stone-500">Sellers keep</p>
        <p className="font-serif text-[7rem] leading-[0.9] tracking-[-0.05em] tabular-nums sm:text-[11rem] lg:text-[13rem]">
          {/* inline-block: the gradient spans the number itself, not the whole row. */}
          <CountUp
            value={keep}
            suffix="%"
            className="inline-block bg-gradient-to-r from-brand-500 via-peach-500 to-berry-500 bg-[length:200%_100%] bg-clip-text pr-[0.04em] text-transparent tabular-nums motion-safe:animate-[gradient-pan_8s_ease-in-out_infinite_alternate]"
          />
        </p>
        <p className="mt-3 text-xs font-semibold tracking-[0.12em] text-stone-500 uppercase">of every sale</p>

        <h2 id="creators-heading" className="mx-auto mt-12 max-w-2xl font-serif text-[2.25rem] leading-[1.05] tracking-[-0.025em] text-ink text-balance sm:text-[3rem]">
          Sell your work. Keep what you earn.
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-lg text-stone-600">
          Open a shop in minutes, list templates, printables or design files, and get paid to your bank account or mobile wallet.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/sell/signup" className="btn btn-lg btn-primary">
            Start selling
            <ArrowRight size={18} strokeWidth={2} aria-hidden="true" />
          </Link>
          <Link href="/legal/seller-agreement" className="btn btn-lg btn-outline">
            Seller agreement
          </Link>
        </div>
      </Reveal>
    </section>
  );
}
