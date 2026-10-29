import Image from 'next/image';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import Reveal from '@/components/Reveal';
import { Eyebrow, Marker, Glow, Sparkle } from '@/components/home/Editorial';
import { HERO_SLIDES } from '@/components/home/heroSlides';
import { NEUTRAL_BLUR_DATA_URL } from '@/lib/utils';
import { siteConfig } from '@/lib/site';

/** A small rounded photo set inline between the words of the statement (decorative). */
function Pill({ photo, rotate = '' }) {
  return (
    <span aria-hidden="true" className={`relative mx-[0.12em] inline-block h-[0.82em] w-[1.75em] -translate-y-[0.06em] overflow-hidden rounded-full bg-stone-200 align-middle ring-2 ring-white ${rotate}`}>
      <Image src={photo.src} alt="" fill sizes="96px" placeholder="blur" blurDataURL={NEUTRAL_BLUR_DATA_URL} className="object-cover" />
    </span>
  );
}

/**
 * "Why Sellpify": one centred serif statement with small rounded photos set between its words, like an editorial
 * spread, then a short intro with an About us link.
 */
export default function Statement() {
  return (
    <>
      {/* A gentle wave from the white formats strip into this honey band (a smaller cousin of the footer's wave). */}
      <svg aria-hidden="true" viewBox="0 0 1440 60" preserveAspectRatio="none" className="-mb-px block h-6 w-full text-brand-100 sm:h-8 lg:h-10">
        <path d="M0 38C220 12 470 4 720 18s500 34 720 14v28H0Z" fill="currentColor" />
      </svg>
      <section aria-labelledby="statement-heading" className="relative isolate overflow-x-clip bg-gradient-to-b from-brand-100 via-brand-50 to-white pt-16 pb-20 sm:pt-20 sm:pb-24">
        <Glow className="top-10 left-[8%] size-72 bg-brand-200/50" />
        <Glow className="right-[6%] bottom-0 size-80 bg-peach-100/70" />
        <Sparkle className="top-[22%] left-[12%] hidden size-6 text-brand-500 md:block" />
        <Sparkle delay={1500} className="top-[30%] right-[13%] hidden size-4 text-peach-500 md:block" />
        <span aria-hidden="true" className="pointer-events-none absolute right-[9%] bottom-[16%] -z-10 hidden size-24 rounded-full border border-brand-300/70 md:block" />
        <div className="container-page">        <Reveal className="mx-auto max-w-5xl text-center">
            <Eyebrow className="justify-center">Why {siteConfig.name}</Eyebrow>
            <h2 id="statement-heading" className="mt-6 font-serif text-[2rem] leading-[1.3] font-normal tracking-[-0.02em] text-ink sm:text-[2.75rem] lg:text-[3.4rem]">
              Independent creators
              <Pill photo={HERO_SLIDES[0]} rotate="-rotate-3" />
              sell what they make. You get it <Marker>the moment you pay</Marker>,
              <Pill photo={HERO_SLIDES[5]} rotate="rotate-2" />
              and it stays in your library
              <Pill photo={HERO_SLIDES[1]} rotate="-rotate-2" />
              for good.
            </h2>
            <p className="mx-auto mt-8 max-w-xl text-lg leading-relaxed text-stone-600">
              A curated marketplace for digital goods: templates, printables, e-books and design assets made by independent creators.
            </p>
            <Link href="/about" className="mt-6 inline-flex items-center gap-1.5 rounded-full border border-ink px-4 py-2 text-sm font-medium transition-colors hover:bg-ink hover:text-white">
              About us
              <ArrowUpRight size={15} strokeWidth={2} aria-hidden="true" />
            </Link>
          </Reveal>
        </div>
      </section>
    </>
  );
}
