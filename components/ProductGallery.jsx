'use client';

import { useRef, useState } from 'react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight, Play } from 'lucide-react';
import { NEUTRAL_BLUR_DATA_URL } from '@/lib/utils';

/**
 * Product page media: a column of thumbnails on the left (a row under the photo on phones) and the main view with
 * ‹ › arrows, swipe and arrow keys. Photos are shown whole (never cropped), on a blurred copy of the cover.
 */
export default function ProductGallery({ images, videos = [], title, coverBlurDataURL }) {
  const media = [...images.map((url) => ({ type: 'image', url })), ...videos.map((url) => ({ type: 'video', url }))];
  const [index, setIndex] = useState(0);
  const touchX = useRef(null);
  const current = media[index];
  const many = media.length > 1;
  const blur = coverBlurDataURL || NEUTRAL_BLUR_DATA_URL;
  const go = (step) => setIndex((i) => (i + step + media.length) % media.length);

  const arrow =
    'absolute top-1/2 z-10 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-white text-ink shadow-md ring-1 ring-black/5 transition hover:scale-105';

  return (
    <div className="flex flex-col-reverse gap-3 lg:flex-row">
      {many && (
        <ul
          className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:thin] lg:max-h-[min(70vh,40rem)] lg:w-20 lg:shrink-0 lg:flex-col lg:overflow-x-visible lg:overflow-y-auto lg:pr-1 lg:pb-0"
          aria-label="Product photos and videos"
        >
          {media.map((m, i) => (
            <li key={m.url} className="shrink-0">
              <button
                type="button"
                onClick={() => setIndex(i)}
                aria-label={m.type === 'video' ? `Play video ${i - images.length + 1}` : `Show photo ${i + 1}`}
                aria-current={i === index || undefined}
                className={`relative block size-16 overflow-hidden rounded-lg bg-stone-100 ring-2 transition lg:size-[4.5rem] ${
                  i === index ? 'ring-ink' : 'opacity-75 ring-transparent hover:opacity-100'
                }`}
              >
                {m.type === 'video' ? (
                  <>
                    <video
                      src={`${m.url}#t=0.5`}
                      muted
                      playsInline
                      preload="metadata"
                      className="size-full bg-black object-cover"
                      aria-hidden="true"
                    />
                    <span className="absolute inset-0 grid place-items-center">
                      <span className="grid size-7 place-items-center rounded-full bg-white/90 text-black shadow-sm">
                        <Play size={13} strokeWidth={2.5} aria-hidden="true" className="ml-0.5" />
                      </span>
                    </span>
                  </>
                ) : (
                  <Image src={m.url} alt="" fill sizes="80px" placeholder="blur" blurDataURL={NEUTRAL_BLUR_DATA_URL} className="object-cover" />
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      <div
        className="relative aspect-[4/3] min-w-0 flex-1 overflow-hidden rounded-2xl bg-stone-100"
        onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
        onTouchEnd={(e) => {
          const dx = e.changedTouches[0].clientX - (touchX.current ?? e.changedTouches[0].clientX);
          if (many && Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
          touchX.current = null;
        }}
        onKeyDown={(e) => many && (e.key === 'ArrowRight' ? go(1) : e.key === 'ArrowLeft' && go(-1))}
        role="group"
        aria-roledescription="carousel"
        aria-label={`${title}: ${many ? `photo ${index + 1} of ${media.length}` : 'photo'}`}
      >
        {current?.type === 'video' ? (
          <video
            key={current.url}
            src={current.url}
            controls
            playsInline
            preload="metadata"
            className="size-full bg-black object-contain"
            aria-label={`${title}: video`}
          />
        ) : current ? (
          <>
            <span
              aria-hidden="true"
              className="absolute inset-0 scale-110 bg-cover bg-center blur-2xl"
              style={{ backgroundImage: `url("${blur}")` }}
            />
            <Image
              key={current.url}
              src={current.url}
              alt={index === 0 ? title : `${title}: photo ${index + 1}`}
              fill
              preload={index === 0} // the cover is the LCP element
              placeholder="blur"
              blurDataURL={(index === 0 && coverBlurDataURL) || NEUTRAL_BLUR_DATA_URL}
              sizes="(min-width: 1280px) 760px, (min-width: 1024px) 58vw, 100vw"
              className="object-contain"
            />
          </>
        ) : (
          <div className="flex h-full items-center justify-center bg-gradient-to-br from-brand-100 via-peach-50 to-berry-50 font-serif text-8xl text-ink/30">
            {title.charAt(0)}
          </div>
        )}

        {many && (
          <>
            <button type="button" onClick={() => go(-1)} aria-label="Previous photo" className={`${arrow} left-3`}>
              <ChevronLeft size={22} strokeWidth={2} aria-hidden="true" />
            </button>
            <button type="button" onClick={() => go(1)} aria-label="Next photo" className={`${arrow} right-3`}>
              <ChevronRight size={22} strokeWidth={2} aria-hidden="true" />
            </button>
            <span className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/55 px-3 py-0.5 text-xs font-medium text-white tabular-nums lg:hidden">
              {index + 1} / {media.length}
            </span>
          </>
        )}
      </div>
    </div>
  );
}
