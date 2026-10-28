'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Download, Flame, Infinity as InfinityIcon, Pause, Play, ShieldCheck, Zap } from 'lucide-react';
import { HERO_FILLERS } from '@/components/home/heroSlides';
import { NO_PLATFORM_FEE } from '@/lib/commission';
import { formatPrice, NEUTRAL_BLUR_DATA_URL } from '@/lib/utils';

const TRUST = [
  { icon: Download, label: 'Instant download' },
  { icon: ShieldCheck, label: 'Secure checkout' },
  { icon: InfinityIcon, label: 'Lifetime access' },
];

// The gallery needs enough tiles to fill two tall columns; work-related photos top up a small catalogue.
const MIN_SLIDES = 10;
const compact = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });

/** Live products first (like Etsy: the real thing, with its price), then filler photos of the kind of work sold here. */
function buildSlides(products) {
  const slides = products.map((p) => ({
    key: p._id,
    src: p.coverImage,
    alt: p.title,
    href: `/products/${p.slug}`,
    kicker: p.category?.name ?? 'Digital product',
    title: p.title,
    price: p.price === 0 ? 'Free' : formatPrice(p.price, p.currency),
  }));
  for (const f of HERO_FILLERS) {
    if (slides.length >= MIN_SLIDES) break;
    slides.push({ key: f.src, src: f.src, alt: f.alt, href: f.href, kicker: 'Explore', title: f.label });
  }
  return slides;
}

/** One gallery tile: the cover, with a frosted label (category, title, price) — the whole tile links to it. */
function Tile({ slide, hidden, cardClass, sizes }) {
  return (
    <li className={`group/tile relative aspect-[4/5] shrink-0 overflow-hidden rounded-2xl bg-stone-100 ring-1 ring-black/5 ${cardClass}`}>
      <Link href={slide.href} tabIndex={hidden ? -1 : undefined} className="absolute inset-0 focus-visible:outline-offset-[-4px]">
        <Image
          src={slide.src}
          alt={hidden ? '' : slide.alt}
          fill
          sizes={sizes}
          placeholder="blur"
          blurDataURL={NEUTRAL_BLUR_DATA_URL}
          className="object-cover transition-transform duration-700 ease-out group-hover/tile:scale-105"
        />
        <span className="absolute inset-x-2.5 bottom-2.5 flex items-end justify-between gap-2 rounded-xl border border-white/50 bg-white/75 px-3 py-2 shadow-sm backdrop-blur-md">
          <span className="min-w-0">
            <span className="block text-[10px] font-medium uppercase tracking-[0.14em] text-brand-700">{slide.kicker}</span>
            <span className="block truncate text-[13px] font-medium leading-snug text-black">{slide.title}</span>
          </span>
          {slide.price && (
            <span className="shrink-0 rounded-full bg-black px-2.5 py-1 text-xs font-medium tabular-nums text-white">{slide.price}</span>
          )}
        </span>
      </Link>
    </li>
  );
}

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
        // The second copy only exists to close the loop: hidden from assistive tech and the tab order.
        <ul key={copy} aria-hidden={copy === 1 || undefined} className={`flex shrink-0 ${vertical ? 'flex-col gap-5 pb-5' : 'gap-4 pr-4'}`}>
          {slides.map((slide) => (
            <Tile key={slide.key} slide={slide} hidden={copy === 1} cardClass={cardClass} sizes={sizes} />
          ))}
        </ul>
      ))}
    </div>
  );
}

/** Frosted card floating over the gallery (desktop only). */
function GlassCard({ className = '', delay = 0, children }) {
  return (
    <div
      className={`absolute z-10 rounded-2xl border border-white/70 bg-white/80 p-3 shadow-lift backdrop-blur-xl motion-safe:animate-float ${className}`}
      style={{ animationDelay: `${delay}s` }}
    >
      {children}
    </div>
  );
}

/**
 * Homepage hero. Desktop: intro on the left (over a faint dot grid and indigo glow), a two-column gallery of real
 * products on the right with frosted cards floating over it. Below `lg`: the gallery is a horizontal strip on top.
 * @param {{ products: object[], stats: { products: number, downloads: number, creators: number } }} props
 */
export default function HeroShowcase({ products = [], stats }) {
  const [paused, setPaused] = useState(false);
  const slides = buildSlides(products);
  const columns = [slides.filter((_, i) => i % 2 === 0), slides.filter((_, i) => i % 2 === 1)];
  const bestSeller = products.find((p) => p.salesCount > 0);

  const figures = [
    stats?.downloads > 0 && { value: `${compact.format(stats.downloads)}+`, label: 'Downloads' },
    stats?.products > 0 && { value: compact.format(stats.products), label: 'Products' },
    NO_PLATFORM_FEE ? { value: '0%', label: 'Platform fees' } : stats?.creators > 0 && { value: compact.format(stats.creators), label: 'Creators' },
  ].filter(Boolean);

  // WCAG 2.2.2: moving content needs a pause control. Hidden when motion is reduced (nothing moves then).
  const pauseButton = (
    <button
      type="button"
      onClick={() => setPaused((p) => !p)}
      aria-label={paused ? 'Play gallery animation' : 'Pause gallery animation'}
      aria-pressed={paused}
      className="absolute bottom-4 right-4 z-20 grid size-10 place-items-center rounded-full bg-white text-black shadow-[0_8px_24px_rgba(0,0,0,0.12)] transition-transform hover:scale-105 motion-reduce:hidden lg:bottom-6 lg:right-6"
    >
      {paused ? <Play size={15} strokeWidth={2} fill="currentColor" aria-hidden="true" /> : <Pause size={15} strokeWidth={2} fill="currentColor" aria-hidden="true" />}
    </button>
  );

  return (
    <section aria-labelledby="hero-title" className="relative isolate overflow-hidden border-b border-stone-200 bg-white">
      {/* ---------- Futuristic backdrop: dot grid fading out, and a slow indigo glow ---------- */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          backgroundImage: 'radial-gradient(circle, rgb(0 0 0 / 0.08) 1px, transparent 1.3px)',
          backgroundSize: '22px 22px',
          maskImage: 'radial-gradient(ellipse 65% 70% at 22% 50%, black 10%, transparent 75%)',
          WebkitMaskImage: 'radial-gradient(ellipse 65% 70% at 22% 50%, black 10%, transparent 75%)',
        }}
      />
      <div aria-hidden="true" className="pointer-events-none absolute -left-48 top-1/4 -z-10 size-[38rem] rounded-full bg-brand-500/15 blur-[120px] motion-safe:animate-drift" />

      {/* ---------- Gallery strip (phones and tablets) ---------- */}
      <div role="region" aria-label="Featured products" className="group/gallery relative pt-6 sm:pt-8 lg:hidden">
        <Marquee slides={slides} paused={paused} cardClass="w-44 sm:w-52" sizes="(min-width: 640px) 208px, 176px" />
        {pauseButton}
      </div>

      <div className="container-page grid items-center lg:grid-cols-2 lg:gap-16">
        {/* ---------- Intro ---------- */}
        <div className="flex flex-col items-center py-12 text-center sm:py-16 lg:items-start lg:py-24 lg:text-left">
          <p className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white/80 px-3.5 py-1.5 text-sm text-stone-600 backdrop-blur">
            <span aria-hidden="true" className="relative flex size-2">
              <span className="absolute inline-flex size-full rounded-full bg-brand-500 opacity-60 motion-safe:animate-ping" />
              <span className="relative inline-flex size-2 rounded-full bg-brand-600" />
            </span>
            New digital goods every week
          </p>
          <h1 id="hero-title" className="headline mt-6 text-[2.5rem] leading-[1.05] text-black text-balance sm:text-6xl xl:text-[4.5rem]">
            Digital goods for people who <span className="text-brand-600">make things</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-[1.5] text-stone-600 text-pretty sm:text-xl">
            Templates, e-books, software and vector packs from independent creators. Download instantly and start building.
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3 lg:justify-start">
            <Link href="/products" className="btn btn-lg btn-primary shadow-[0_10px_30px_-8px] shadow-brand-600/50">
              Get started
            </Link>
            <Link href="/products?sort=popular" className="btn btn-lg btn-outline bg-white/70 backdrop-blur">
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

          {figures.length > 0 && (
            <dl className="mt-10 grid w-full max-w-md grid-cols-3 divide-x divide-stone-200 border-t border-stone-200 pt-6 text-center lg:text-left">
              {figures.map((f) => (
                <div key={f.label} className="flex flex-col px-3 first:pl-0 lg:px-5 lg:first:pl-0">
                  <dt className="text-[11px] font-medium uppercase tracking-[0.14em] text-stone-500">{f.label}</dt>
                  <dd className="headline order-first mt-1 text-3xl tabular-nums text-black">{f.value}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>

        {/* ---------- Gallery columns (desktop) ---------- */}
        <div role="region" aria-label="Featured products" className="group/gallery relative hidden h-[min(46rem,calc(100svh-7.5rem))] min-h-[36rem] lg:block">
          <div
            className="grid h-full grid-cols-2 gap-5 overflow-hidden"
            style={{
              maskImage: 'linear-gradient(to bottom, transparent, black 9%, black 91%, transparent)',
              WebkitMaskImage: 'linear-gradient(to bottom, transparent, black 9%, black 91%, transparent)',
            }}
          >
            {columns.map((col, i) => (
              <Marquee
                key={i}
                slides={col}
                vertical
                reverse={i === 1}
                delay={i === 1 ? -20 : 0} // start the columns out of step so their rows don't line up
                paused={paused}
                cardClass="w-full"
                sizes="(min-width: 1280px) 300px, 240px"
              />
            ))}
          </div>

          {bestSeller && (
            <GlassCard className="-left-12 top-[18%] w-64">
              <Link href={`/products/${bestSeller.slug}`} className="flex items-center gap-3">
                <span className="relative size-12 shrink-0 overflow-hidden rounded-xl bg-stone-100">
                  <Image src={bestSeller.coverImage} alt="" fill sizes="48px" className="object-cover" />
                </span>
                <span className="min-w-0">
                  <span className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-[0.12em] text-orange-600">
                    <Flame size={12} strokeWidth={2.25} aria-hidden="true" />
                    Best seller
                  </span>
                  <span className="block truncate text-sm font-medium text-black">{bestSeller.title}</span>
                  <span className="block text-xs tabular-nums text-stone-500">
                    {bestSeller.salesCount.toLocaleString('en-US')} {bestSeller.price === 0 ? 'downloads' : 'sold'}
                  </span>
                </span>
              </Link>
            </GlassCard>
          )}
          <GlassCard className="-left-8 bottom-[16%] flex items-center gap-3 pr-4" delay={-3.5}>
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-600 text-white shadow-[0_8px_20px_-6px] shadow-brand-600/60">
              <Zap size={18} strokeWidth={2} aria-hidden="true" />
            </span>
            <span>
              <span className="block text-sm font-medium text-black">Instant delivery</span>
              <span className="block text-xs text-stone-500">Files ready the moment you pay</span>
            </span>
          </GlassCard>

          {pauseButton}
        </div>
      </div>
    </section>
  );
}
