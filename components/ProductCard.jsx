import Image from 'next/image';
import Link from 'next/link';
import { ArrowUpRight, Download, Flame } from 'lucide-react';
import AddToCartButton from '@/components/AddToCartButton';
import CategoryIcon from '@/components/CategoryIcon';
import { formatPrice, isAccessLink, NEUTRAL_BLUR_DATA_URL } from '@/lib/utils';
import { categoryHref } from '@/lib/category-tree';

// Earned, not hand-picked: products with at least this many sales get the "Bestseller" badge.
const BESTSELLER_MIN_SALES = 250;

/**
 * Server Component. Only the "Add" pill ships client JS.
 * Framed cover (inset image), category + format label, title, description, price block and Add button.
 * The title link is stretched over the whole card; the category link and the Add button sit above it.
 * Pass `preload` only for above-the-fold cards (first row) to improve LCP.
 */
export default function ProductCard({ product, preload = false }) {
  const { _id, title, slug, shortDescription, price, compareAtPrice, currency, coverImage, coverBlurDataURL, category, fileFormat, deliveryType, salesCount } =
    product;
  const href = `/products/${slug}`;
  const discount = compareAtPrice > price ? Math.round((1 - price / compareAtPrice) * 100) : 0;
  const bestseller = salesCount >= BESTSELLER_MIN_SALES;

  return (
    <article className="group relative flex h-full flex-col rounded-3xl border border-stone-200 bg-white p-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-[translate,box-shadow] duration-300 ease-out hover:-translate-y-1 hover:shadow-lift motion-reduce:hover:translate-y-0">
      {/* ---------- Framed cover ---------- */}
      <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-stone-100">
        {coverImage ? (
          <Image
            src={coverImage}
            alt=""
            fill
            preload={preload}
            placeholder="blur"
            blurDataURL={coverBlurDataURL || NEUTRAL_BLUR_DATA_URL}
            sizes="(min-width: 1280px) 400px, (min-width: 1024px) 31vw, (min-width: 640px) 47vw, 92vw"
            className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.05]"
          />
        ) : (
          <span aria-hidden="true" className="headline flex h-full items-center justify-center text-7xl text-stone-400">
            {title.charAt(0)}
          </span>
        )}

        <div className="absolute inset-x-3 top-3 flex items-start justify-between gap-2">
          {bestseller ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-1 text-xs font-medium text-black shadow-sm backdrop-blur">
              <Flame size={13} strokeWidth={2} aria-hidden="true" className="text-orange-500" />
              Bestseller
            </span>
          ) : (
            <span />
          )}
          {discount > 0 && <span className="rounded-full bg-brand-600 px-2.5 py-1 text-xs font-medium text-white shadow-sm">−{discount}%</span>}
        </div>

        {/* Hover hint (decorative — the whole card is already the link). */}
        <span
          aria-hidden="true"
          className="absolute bottom-3 left-3 inline-flex translate-y-2 items-center gap-1 rounded-full bg-white/95 px-3 py-1.5 text-xs font-medium text-black opacity-0 shadow-sm backdrop-blur transition duration-300 group-hover:translate-y-0 group-hover:opacity-100"
        >
          View details
          <ArrowUpRight size={14} strokeWidth={2} />
        </span>
      </div>

      {/* ---------- Body ---------- */}
      <div className="flex flex-1 flex-col px-3 pb-3 pt-4">
        {(category?.name || fileFormat) && (
          <p className="flex min-w-0 items-center gap-2 text-xs text-stone-500">
            {category?.name && (
              <Link
                href={categoryHref(category)}
                className="relative z-10 inline-flex shrink-0 items-center gap-1.5 font-medium text-stone-700 transition-colors hover:text-brand-600"
              >
                <CategoryIcon slug={(category.slugPath ?? category.slug).split('/')[0]} className="size-3.5" />
                {category.name}
              </Link>
            )}
            {category?.name && fileFormat && <span aria-hidden="true" className="size-1 shrink-0 rounded-full bg-stone-300" />}
            {fileFormat && <span className="truncate">{fileFormat}</span>}
          </p>
        )}

        <h3 className="mt-2.5 line-clamp-2 text-[17px] font-medium leading-snug tracking-[-0.01em] text-black">
          <Link
            href={href}
            className="after:absolute after:inset-0 after:rounded-3xl focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-brand-500"
          >
            {title}
          </Link>
        </h3>
        {shortDescription && <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-stone-500">{shortDescription}</p>}

        {/* ---------- Price + add ---------- */}
        <div className="mt-auto flex items-end justify-between gap-3 pt-5">
          <div>
            <p className="flex items-baseline gap-2">
              <span className="headline text-[1.65rem] leading-none tabular-nums text-black">{price === 0 ? 'Free' : formatPrice(price, currency)}</span>
              {discount > 0 && <span className="text-sm text-stone-400 line-through tabular-nums">{formatPrice(compareAtPrice, currency)}</span>}
            </p>
            {salesCount > 0 && (
              <p className="mt-1.5 flex items-center gap-1 text-xs text-stone-500">
                <Download size={12} strokeWidth={2} aria-hidden="true" />
                {salesCount.toLocaleString('en-US')} {price === 0 ? 'downloads' : 'sold'}
              </p>
            )}
          </div>
          {/* Pass only what the cart needs to keep the client payload small. */}
          <AddToCartButton compact className="relative z-10" product={{ _id, slug, title, price, currency, coverImage, accessLink: isAccessLink({ deliveryType, fileFormat }) }} />
        </div>
      </div>
    </article>
  );
}
