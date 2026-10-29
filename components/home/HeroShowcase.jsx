import Image from 'next/image';
import { Search } from 'lucide-react';
import { HERO_BACKGROUND, HERO_PHOTOS } from '@/components/home/heroSlides';
import { NEUTRAL_BLUR_DATA_URL } from '@/lib/utils';

/** One rounded photo card. `className` places and sizes it; the photo fills it. */
function Photo({ photo, className, sizes }) {
  return (
    <div className={`absolute overflow-hidden rounded-2xl bg-stone-200 shadow-[0_18px_40px_rgba(20,20,20,0.14)] ${className}`}>
      <Image src={photo.src} alt={photo.alt} fill sizes={sizes} placeholder="blur" blurDataURL={NEUTRAL_BLUR_DATA_URL} className="object-cover" />
    </div>
  );
}

/**
 * Homepage hero — warm paper canvas with a centred serif headline and search field, framed on large screens by two
 * mirrored clusters of maker photos over soft colour shapes, filling the screen below the navbar. On load the text rises in,
 * the shapes grow and the photos float up in turn (CSS only, skipped under "reduce motion"). Below `lg` the photos
 * sit in a short row under the search. Server markup only (the search is a plain GET form to /products).
 */
export default function HeroShowcase() {
  const [leftTop, leftBottom, rightTop, rightBottom] = HERO_PHOTOS;
  const sideSizes = '(min-width: 1280px) 220px, 18vw';

  return (
    <section aria-labelledby="hero-title" className="relative isolate overflow-hidden border-b border-stone-200 bg-paper">
      {/* ---------- Background: optional photo, else a faint journal grid fading out towards the edges ---------- */}
      {HERO_BACKGROUND ? (
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
          <Image src={HERO_BACKGROUND.src} alt="" fill sizes="100vw" className="object-cover" />
          <div className="absolute inset-0 bg-paper/80" />
        </div>
      ) : (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 [mask-image:radial-gradient(ellipse_75%_70%_at_50%_45%,#000_30%,transparent_100%)]"
          style={{
            backgroundImage: 'linear-gradient(to right, rgb(20 20 20 / 0.05) 1px, transparent 1px), linear-gradient(to bottom, rgb(20 20 20 / 0.05) 1px, transparent 1px)',
            backgroundSize: '56px 56px',
          }}
        />
      )}

      <div className="container-page relative">
        {/* ---------- Photo clusters framing the headline (large screens) ---------- */}
        <div className="absolute left-4 top-1/2 hidden h-[36rem] w-[23%] -translate-y-1/2 motion-safe:animate-hero-float lg:block xl:left-8">
          <div aria-hidden="true" className="absolute left-[4%] top-[18%] h-[66%] w-[92%] rounded-[58%_42%_52%_48%/48%_56%_44%_52%] bg-brand-100 motion-safe:animate-hero-blob motion-safe:[animation-delay:150ms,1450ms]" />
          <Photo photo={leftTop} sizes={sideSizes} className="left-0 top-[12%] aspect-[4/5] w-[66%] -rotate-3 motion-safe:animate-hero-photo motion-safe:[animation-delay:300ms]" />
          <Photo photo={leftBottom} sizes={sideSizes} className="bottom-[10%] right-0 aspect-[4/5] w-[58%] rotate-2 motion-safe:animate-hero-photo motion-safe:[animation-delay:500ms]" />
        </div>

        <div className="absolute right-4 top-1/2 hidden h-[36rem] w-[23%] -translate-y-1/2 motion-safe:animate-hero-float motion-safe:[animation-direction:alternate-reverse] lg:block xl:right-8">
          <div aria-hidden="true" className="absolute right-[4%] top-[18%] h-[66%] w-[92%] rounded-[42%_58%_48%_52%/56%_48%_52%_44%] bg-tint-mint motion-safe:animate-hero-blob motion-safe:[animation-delay:250ms,1550ms]" />
          <div aria-hidden="true" className="absolute bottom-[4%] left-[6%] size-24 rounded-full bg-tint-butter motion-safe:animate-hero-blob motion-safe:[animation-delay:600ms,1900ms]" />
          <Photo photo={rightTop} sizes={sideSizes} className="right-0 top-[12%] aspect-[4/5] w-[66%] rotate-3 motion-safe:animate-hero-photo motion-safe:[animation-delay:400ms]" />
          <Photo photo={rightBottom} sizes={sideSizes} className="bottom-[10%] left-0 aspect-[4/5] w-[58%] -rotate-2 motion-safe:animate-hero-photo motion-safe:[animation-delay:600ms]" />
        </div>

        {/* ---------- Intro ---------- */}
        <div className="relative mx-auto flex flex-col items-center py-14 text-center sm:py-20 lg:min-h-[max(38rem,calc(100svh-6.1rem))] lg:w-[50%] lg:justify-center lg:py-16">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-stone-500 motion-safe:animate-hero-rise">The marketplace for digital goods</p>
          <h1
            id="hero-title"
            className="mt-5 font-serif text-[2.75rem] font-normal leading-[1.05] tracking-tight text-gray-900 text-balance motion-safe:animate-hero-rise motion-safe:[animation-delay:100ms] sm:text-6xl xl:text-7xl"
          >
            Digital goods for people who <em className="relative isolate inline-block font-normal motion-safe:animate-hero-rise motion-safe:[animation-delay:450ms]">
              make things
              <svg
                aria-hidden="true"
                viewBox="0 0 300 24"
                preserveAspectRatio="none"
                className="absolute -inset-x-[3%] bottom-[0.06em] -z-10 h-[0.42em] w-[106%] text-highlight"
              >
                <path
                  d="M4 15C62 8 128 5 190 8s82 6 106 3"
                  pathLength="1"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="16"
                  strokeLinecap="round"
                  className="[stroke-dasharray:1] motion-safe:animate-hero-draw"
                />
              </svg>
            </em>
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-stone-600 text-pretty motion-safe:animate-hero-rise motion-safe:[animation-delay:250ms]">
            Patterns, printables, templates and design assets from independent creators. Pay once, download instantly, keep
            it forever.
          </p>

          <form action="/products" role="search" className="mt-9 w-full max-w-lg motion-safe:animate-hero-rise motion-safe:[animation-delay:380ms]">
            <label htmlFor="hero-search" className="sr-only">
              Search products
            </label>
            <div className="flex items-center gap-2 rounded-full border border-stone-300 bg-white p-1.5 pl-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-colors focus-within:border-stone-900">
              <Search size={18} strokeWidth={1.75} aria-hidden="true" className="shrink-0 text-stone-400" />
              <input
                id="hero-search"
                name="q"
                type="search"
                autoComplete="off"
                placeholder="Crochet patterns, planners, fonts…"
                className="min-w-0 flex-1 bg-transparent py-2 text-[15px] text-gray-900 placeholder:text-stone-400 focus:outline-none"
              />
              <button type="submit" className="btn btn-md btn-primary shrink-0">
                Search
              </button>
            </div>
          </form>

          {/* ---------- Photos (phones and tablets): three cards over the colour shapes ---------- */}
          <div className="relative mt-14 h-56 w-full max-w-md sm:h-72 lg:hidden">
            <div aria-hidden="true" className="absolute inset-x-[8%] bottom-0 top-[10%] rounded-[50%_50%_46%_54%/58%_52%_48%_42%] bg-brand-100 motion-safe:animate-hero-blob motion-safe:[animation-delay:300ms,1600ms]" />
            <div aria-hidden="true" className="absolute bottom-[6%] right-[2%] size-20 rounded-full bg-tint-mint motion-safe:animate-hero-blob motion-safe:[animation-delay:600ms,1900ms] sm:size-24" />
            <Photo photo={leftTop} sizes="35vw" className="bottom-[4%] left-[2%] aspect-[4/5] w-[34%] -rotate-3 motion-safe:animate-hero-photo motion-safe:[animation-delay:450ms]" />
            <Photo photo={rightTop} sizes="35vw" className="left-1/2 top-0 z-10 aspect-[4/5] w-[38%] -translate-x-1/2 motion-safe:animate-hero-photo motion-safe:[animation-delay:550ms]" />
            <Photo photo={rightBottom} sizes="35vw" className="bottom-[4%] right-[2%] aspect-[4/5] w-[34%] rotate-3 motion-safe:animate-hero-photo motion-safe:[animation-delay:650ms]" />
          </div>
        </div>
      </div>
    </section>
  );
}
