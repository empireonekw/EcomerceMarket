'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Download, Infinity as InfinityIcon, Pause, Play, ShieldCheck } from 'lucide-react';
import { HERO_SLIDES } from '@/components/home/heroSlides';
import { Eyebrow } from '@/components/PageIntro';
import { NEUTRAL_BLUR_DATA_URL } from '@/lib/utils';

const TRUST = [
  { icon: Download, label: 'Instant download' },
  { icon: ShieldCheck, label: 'Secure checkout' },
  { icon: InfinityIcon, label: 'Lifetime access' },
];

// Desktop: two columns of six, scrolling in opposite directions.
const COLUMNS = [HERO_SLIDES.filter((_, i) => i % 2 === 0), HERO_SLIDES.filter((_, i) => i % 2 === 1)];

/**
 * Endless CSS marquee: the slides are rendered twice and the track moves by -50% (one copy) per loop.
 * Pauses when `paused` or while the pointer is over the gallery, and never runs under "reduce motion".
 */
function Marquee({ slides, vertical, reverse, delay = 0, paused, cardClass, sizes }) {
  const axis = vertical ? 'flex-col motion-safe:animate-marquee-y' : 'w-max motion-safe:animate-marquee-x';
  // `!` because the motion-safe `animation` shorthand would otherwise reset the play state to running.
  return (
    <div
      className={`flex ${axis} group-hover/gallery:[animation-play-state:paused]! ${paused ? '[animation-play-state:paused]!' : ''}`}
      style={{ animationDirection: reverse ? 'reverse' : undefined, animationDelay: delay ? `${delay}s` : undefined }}
    >
      {[0, 1].map((copy) => (
        // Trailing padding equals the gap, so both copies are exactly the same length.
        // The second copy only exists to close the loop: hide it from assistive tech.
        <ul key={copy} aria-hidden={copy === 1 || undefined} className={`flex shrink-0 ${vertical ? 'flex-col gap-5 pb-5' : 'gap-4 pr-4'}`}>
          {slides.map((slide) => (
            <li key={slide.src} className={`relative aspect-[4/5] shrink-0 overflow-hidden rounded-2xl bg-stone-100 ${cardClass}`}>
              <Image
                src={slide.src}
                alt={copy === 0 ? slide.alt : ''}
                fill
                sizes={sizes}
                placeholder="blur"
                blurDataURL={NEUTRAL_BLUR_DATA_URL}
                className="object-cover"
              />
            </li>
          ))}
        </ul>
      ))}
    </div>
  );
}

/**
 * Homepage hero. Desktop: intro on the left, a two-column gallery filling the right half.
 * Below `lg`: the gallery becomes a horizontal strip on top, with the intro centred beneath it.
 */
export default function HeroShowcase() {
  const [paused, setPaused] = useState(false);

  // WCAG 2.2.2: moving content needs a pause control. Hidden when motion is reduced (nothing moves then).
  const pauseButton = (
    <button
      type="button"
      onClick={() => setPaused((p) => !p)}
      aria-label={paused ? 'Play gallery animation' : 'Pause gallery animation'}
      aria-pressed={paused}
      className="absolute bottom-4 right-4 grid size-10 place-items-center rounded-full bg-white text-black shadow-[0_8px_24px_rgba(0,0,0,0.12)] transition-transform hover:scale-105 motion-reduce:hidden lg:bottom-6 lg:right-6"
    >
      {paused ? <Play size={15} strokeWidth={2} fill="currentColor" aria-hidden="true" /> : <Pause size={15} strokeWidth={2} fill="currentColor" aria-hidden="true" />}
    </button>
  );

  return (
    <section aria-labelledby="hero-title" className="overflow-hidden border-b border-stone-200 bg-white">
      {/* ---------- Gallery strip (phones and tablets) ---------- */}
      <div role="region" aria-label="Featured creative work" className="group/gallery relative pt-6 sm:pt-8 lg:hidden">
        <Marquee slides={HERO_SLIDES} paused={paused} cardClass="w-44 sm:w-52" sizes="(min-width: 640px) 208px, 176px" />
        {pauseButton}
      </div>

      <div className="container-page grid items-center lg:grid-cols-2 lg:gap-16">
        {/* ---------- Intro ---------- */}
        <div className="flex flex-col items-center py-12 text-center sm:py-16 lg:items-start lg:py-24 lg:text-left">
          <Eyebrow>New digital goods every week</Eyebrow>
          <h1 id="hero-title" className="headline mt-6 text-[2.5rem] leading-[1.05] text-black text-balance sm:text-6xl xl:text-[4.5rem]">
            Digital goods for people who make things
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-[1.5] text-stone-600 text-pretty sm:text-xl">
            Templates, e-books, software and vector packs from independent creators. Download instantly and start building.
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3 lg:justify-start">
            <Link
              href="/products"
              className="btn btn-lg btn-primary"
            >
              Get started
            </Link>
            <Link
              href="/products?sort=popular"
              className="btn btn-lg btn-outline"
            >
              See best sellers
            </Link>
          </div>
          <ul className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-stone-500 lg:justify-start">
            {TRUST.map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-center gap-1.5">
                <Icon size={16} strokeWidth={1.75} aria-hidden="true" />
                {label}
              </li>
            ))}
          </ul>
        </div>

        {/* ---------- Gallery columns (desktop) ---------- */}
        <div
          role="region"
          aria-label="Featured creative work"
          className="group/gallery relative hidden h-[min(46rem,calc(100svh-7.5rem))] min-h-[36rem] lg:block"
        >
          <div className="grid h-full grid-cols-2 gap-5 overflow-hidden">
            {COLUMNS.map((slides, i) => (
              <Marquee
                key={i}
                slides={slides}
                vertical
                reverse={i === 1}
                delay={i === 1 ? -20 : 0} // start the columns out of step so their rows don't line up
                paused={paused}
                cardClass="w-full"
                sizes="(min-width: 1280px) 300px, 240px"
              />
            ))}
          </div>
          {pauseButton}
        </div>
      </div>
    </section>
  );
}
