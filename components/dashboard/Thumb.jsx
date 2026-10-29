'use client';

import { useState } from 'react';
import Image from 'next/image';
import { ImageOff } from 'lucide-react';
import { NEUTRAL_BLUR_DATA_URL } from '@/lib/utils';

/** A product thumbnail for dashboard lists. A missing or broken cover shows a neutral placeholder, not a broken image. */
export default function Thumb({ src, sizes, className = '' }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className={`relative grid shrink-0 place-items-center overflow-hidden rounded-lg bg-stone-100 text-stone-400 ${className}`}>
      {src && !failed ? (
        <Image src={src} alt="" fill sizes={sizes} placeholder="blur" blurDataURL={NEUTRAL_BLUR_DATA_URL} className="object-cover" onError={() => setFailed(true)} />
      ) : (
        <ImageOff size={16} strokeWidth={1.75} aria-hidden="true" />
      )}
    </div>
  );
}
