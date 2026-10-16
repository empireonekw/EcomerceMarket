import Image from 'next/image';
import Link from 'next/link';
import { Download, FileArchive } from 'lucide-react';
import AddToCartButton from '@/components/AddToCartButton';
import { formatPrice, NEUTRAL_BLUR_DATA_URL } from '@/lib/utils';

/**
 * Server Component. Only the "Add" pill ships client JS.
 * The title link is stretched over the whole card; the category pill and the Add button sit above it.
 * Pass `preload` only for above-the-fold cards (first row) to improve LCP.
 */
export default function ProductCard({ product, preload = false }) {
  const { _id, title, slug, shortDescription, price, compareAtPrice, currency, coverImage, coverBlurDataURL, category, fileFormat, salesCount } =
    product;
  const href = `/products/${slug}`;
  const discount = compareAtPrice > price ? Math.round((1 - price / compareAtPrice) * 100) : 0;

  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white transition-[translate,box-shadow,border-color] duration-300 ease-out hover:-translate-y-1 hover:border-transparent hover:shadow-lift motion-reduce:hover:translate-y-0">
      {/* ---------- Cover ---------- */}
      <div className="relative aspect-[16/10] overflow-hidden bg-stone-100">
        {coverImage ? (
          <Image
            src={coverImage}
            alt=""
            fill
            preload={preload}
            placeholder="blur"
            blurDataURL={coverBlurDataURL || NEUTRAL_BLUR_DATA_URL}
            sizes="(min-width: 1280px) 400px, (min-width: 1024px) 31vw, (min-width: 640px) 47vw, 92vw"
            className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
          />
        ) : (
          <span aria-hidden="true" className="headline flex h-full items-center justify-center text-7xl text-stone-400">
            {title.charAt(0)}
          </span>
        )}
        {category?.name && (
          <Link
            href={`/products?category=${category.slug}`}
            className="absolute left-4 top-4 z-10 rounded-full bg-white/90 px-3 py-1 text-xs font-medium text-black backdrop-blur transition-colors hover:bg-white"
          >
            {category.name}
          </Link>
        )}
        {discount > 0 && (
          <span className="absolute right-4 top-4 rounded-full bg-black px-2.5 py-1 text-xs font-medium text-white">Save {discount}%</span>
        )}
      </div>

      {/* ---------- Body ---------- */}
      <div className="flex flex-1 flex-col p-5 sm:p-6">
        <h3 className="line-clamp-2 text-lg font-medium leading-snug tracking-[-0.01em]">
          <Link href={href} className="after:absolute after:inset-0 after:rounded-2xl focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-brand-500">
            {title}
          </Link>
        </h3>
        {shortDescription && <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-stone-500">{shortDescription}</p>}

        {(fileFormat || salesCount > 0) && (
          <ul className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-stone-500">
            {fileFormat && (
              <li className="flex min-w-0 items-center gap-1.5">
                <FileArchive size={14} strokeWidth={1.75} aria-hidden="true" className="shrink-0" />
                <span className="truncate">{fileFormat}</span>
              </li>
            )}
            {salesCount > 0 && (
              <li className="flex items-center gap-1.5">
                <Download size={14} strokeWidth={1.75} aria-hidden="true" />
                {salesCount.toLocaleString('en-US')} sales
              </li>
            )}
          </ul>
        )}

        {/* ---------- Footer: price + add ---------- */}
        <div className="mt-auto pt-5">
          <div className="flex items-center justify-between gap-3 border-t border-stone-200 pt-4">
            <p className="flex items-baseline gap-2">
              <span className="text-xl font-medium tabular-nums">{price === 0 ? 'Free' : formatPrice(price, currency)}</span>
              {discount > 0 && <span className="text-sm text-stone-400 line-through tabular-nums">{formatPrice(compareAtPrice, currency)}</span>}
            </p>
            {/* Pass only what the cart needs to keep the client payload small. */}
            <AddToCartButton compact className="relative z-10" product={{ _id, slug, title, price, currency, coverImage }} />
          </div>
        </div>
      </div>
    </article>
  );
}
