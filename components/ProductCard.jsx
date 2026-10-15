import Image from 'next/image';
import Link from 'next/link';
import AddToCartButton from '@/components/AddToCartButton';
import { formatPrice, NEUTRAL_BLUR_DATA_URL } from '@/lib/utils';

/**
 * Server Component. Only the "Add" pill ships client JS.
 * The title link is stretched over the whole card; the category pill and the Add button sit above it.
 * Pass `preload` only for above-the-fold cards (first row) to improve LCP.
 */
export default function ProductCard({ product, preload = false }) {
  const { _id, title, slug, price, compareAtPrice, currency, coverImage, coverBlurDataURL, category, fileFormat, salesCount } = product;
  const href = `/products/${slug}`;
  const discount = compareAtPrice > price ? Math.round((1 - price / compareAtPrice) * 100) : 0;
  const meta = [fileFormat, salesCount > 0 && `${salesCount.toLocaleString('en-US')} sales`].filter(Boolean).join(' · ');

  return (
    <article className="group relative flex h-full flex-col">
      <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-stone-100 ring-1 ring-black/5 transition-[translate,box-shadow] duration-300 ease-out group-hover:-translate-y-1 group-hover:shadow-lift motion-reduce:group-hover:translate-y-0">
        {coverImage ? (
          <Image
            src={coverImage}
            alt=""
            fill
            preload={preload}
            placeholder="blur"
            blurDataURL={coverBlurDataURL || NEUTRAL_BLUR_DATA_URL}
            sizes="(min-width: 1280px) 22vw, (min-width: 1024px) 30vw, (min-width: 640px) 45vw, 92vw"
            className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
          />
        ) : (
          <span aria-hidden="true" className="headline flex h-full items-center justify-center text-6xl text-stone-400">
            {title.charAt(0)}
          </span>
        )}
        {category?.name && (
          <Link
            href={`/products?category=${category.slug}`}
            className="absolute left-3 top-3 z-10 rounded-full bg-white/90 px-3 py-1 text-xs text-black backdrop-blur transition-colors hover:bg-white"
          >
            {category.name}
          </Link>
        )}
        {discount > 0 && (
          <span className="absolute right-3 top-3 rounded-full bg-black px-2.5 py-1 text-xs font-medium text-white">−{discount}%</span>
        )}
      </div>

      <div className="flex flex-1 flex-col pt-4">
        <h3 className="line-clamp-2 text-[17px] font-medium leading-snug tracking-[-0.01em]">
          <Link href={href} className="after:absolute after:inset-0 after:rounded-2xl focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-offset-4 focus-visible:after:outline-brand-500">
            {title}
          </Link>
        </h3>
        {meta && <p className="mt-1 truncate text-sm text-stone-500">{meta}</p>}

        <div className="mt-auto flex items-center justify-between gap-3 pt-4">
          <p className="flex items-baseline gap-2">
            <span className="text-lg font-medium tabular-nums">{price === 0 ? 'Free' : formatPrice(price, currency)}</span>
            {discount > 0 && <span className="text-sm text-stone-400 line-through tabular-nums">{formatPrice(compareAtPrice, currency)}</span>}
          </p>
          {/* Pass only what the cart needs to keep the client payload small. */}
          <AddToCartButton compact className="relative z-10" product={{ _id, slug, title, price, currency, coverImage }} />
        </div>
      </div>
    </article>
  );
}
