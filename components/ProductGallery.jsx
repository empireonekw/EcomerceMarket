'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Play } from 'lucide-react';
import { NEUTRAL_BLUR_DATA_URL } from '@/lib/utils';

/** Product page media: the main view (cover first) and a row of thumbnails — photos, then videos. */
export default function ProductGallery({ images, videos = [], title, coverBlurDataURL }) {
  const media = [...images.map((url) => ({ type: 'image', url })), ...videos.map((url) => ({ type: 'video', url }))];
  const [index, setIndex] = useState(0);
  const current = media[index];

  return (
    <div>
      <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-stone-200 bg-stone-100">
        {current?.type === 'video' ? (
          <video
            key={current.url}
            src={current.url}
            controls
            playsInline
            preload="metadata"
            className="size-full bg-black object-contain"
            aria-label={`${title} — video`}
          />
        ) : current ? (
          <Image
            key={current.url}
            src={current.url}
            alt={index === 0 ? title : `${title} — photo ${index + 1}`}
            fill
            preload={index === 0} // the cover is the LCP element
            placeholder="blur"
            blurDataURL={(index === 0 && coverBlurDataURL) || NEUTRAL_BLUR_DATA_URL}
            sizes="(min-width: 1280px) 720px, (min-width: 1024px) 58vw, 100vw"
            className="object-cover"
          />
        ) : null}
      </div>
      {media.length > 1 && (
        <ul className="mt-3 grid grid-cols-5 gap-2 sm:grid-cols-6" aria-label="Product photos and videos">
          {media.map((m, i) => (
            <li key={m.url}>
              <button
                type="button"
                onClick={() => setIndex(i)}
                aria-label={m.type === 'video' ? `Play video ${i - images.length + 1}` : `Show photo ${i + 1}`}
                aria-current={i === index || undefined}
                className={`relative block aspect-square w-full overflow-hidden rounded-lg border-2 bg-stone-100 transition-colors ${
                  i === index ? 'border-ink' : 'border-transparent hover:border-stone-300'
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
                  <Image src={m.url} alt="" fill sizes="96px" placeholder="blur" blurDataURL={NEUTRAL_BLUR_DATA_URL} className="object-cover" />
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
