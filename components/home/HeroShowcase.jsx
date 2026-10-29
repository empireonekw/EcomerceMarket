'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Download, Infinity as InfinityIcon, Pause, Play, ShieldCheck } from 'lucide-react';
import { HERO_BACKGROUND, HERO_SLIDES } from '@/components/home/heroSlides';
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
    <section aria-labelledby="hero-title" className="relative isolate overflow-hidden border-b border-stone-200 bg-white">
      {/* ---------- Optional background photo (HERO_BACKGROUND in heroSlides.js; null = none) ---------- */}
      {HERO_BACKGROUND && (
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
          <Image src={HERO_BACKGROUND.src} alt="" fill sizes="100vw" loading="eager" fetchPriority="high" className="object-cover object-bottom" />
          {/* White veil so the text stays crisp: even on phones; on desktop strongest behind the text, lighter towards the photos. */}
          <div className="absolute inset-0 bg-white/70 lg:hidden" />
          <div
            className="absolute inset-0 hidden lg:block"
            style={{ backgroundImage: 'linear-gradient(90deg, rgb(255 255 255 / 0.7) 0%, rgb(255 255 255 / 0.45) 45%, rgb(255 255 255 / 0) 100%)' }}
          />
        </div>
      )}

      {/* ---------- Gallery strip (phones and tablets) ---------- */}
      <div role="region" aria-label="Featured creative work" className="group/gallery relative pt-6 sm:pt-8 lg:hidden">
        <Marquee slides={HERO_SLIDES} paused={paused} cardClass="w-44 sm:w-52" sizes="(min-width: 640px) 208px, 176px" />
        {pauseButton}
      </div>

      <div className="container-page grid items-center lg:grid-cols-2 lg:gap-16">
        {/* ---------- Intro ---------- */}
        <div className="flex flex-col items-center py-12 text-center sm:py-16 lg:items-start lg:py-24 lg:text-left">
          <p className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-gray-100 px-3.5 py-1.5 text-sm text-gray-700">
            <span aria-hidden="true" className="size-1.5 rounded-full bg-brand-600" />
            New digital goods every week
          </p>
          <h1
            id="hero-title"
            className="mt-6 font-serif text-4xl font-semibold leading-[1.15] tracking-tight text-gray-900 text-balance sm:text-5xl lg:text-6xl"
          >
            Digital goods for people who make things
          </h1>
          <p className="mt-6 max-w-xl font-sans text-lg leading-relaxed text-gray-600 text-pretty">
            Templates, e-books, software and vector packs from independent creators. Download instantly and start building.
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3 lg:justify-start">
            <Link
              href="/products"
              className="btn btn-lg btn-primary rounded-full"
            >
              Get started
            </Link>
            <Link
              href="/products?sort=popular"
              className="btn btn-lg rounded-full border border-gray-200 bg-gray-100 text-gray-900 hover:border-gray-300 hover:bg-gray-200"
            >
              See best sellers
            </Link>
          </div>
          <ul className="mt-8 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs font-medium text-gray-500 lg:justify-start">
            {TRUST.map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-center gap-1.5">
                <Icon size={15} strokeWidth={1.75} aria-hidden="true" className="text-gray-500" />
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
