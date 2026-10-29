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
 * Editorial card: a borderless rounded cover (format and sale/bestseller labels on it, "View details" on hover), then
 * the category, a serif title, a short description and a price row with the Add button.
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
    <article className="group relative flex h-full flex-col">
      {/* ---------- Cover ---------- */}
      <div className="relative aspect-[4/5] overflow-hidden rounded-[1.4rem] bg-stone-100 shadow-[0_1px_2px_rgba(20,20,20,0.05)] ring-1 ring-black/5 transition-shadow duration-500 group-hover:shadow-[0_24px_50px_-24px_rgba(20,20,20,0.45)]">
        {coverImage ? (
          <Image
            src={coverImage}
            alt=""
            fill
            preload={preload}
            placeholder="blur"
            blurDataURL={coverBlurDataURL || NEUTRAL_BLUR_DATA_URL}
            sizes="(min-width: 1280px) 300px, (min-width: 1024px) 31vw, (min-width: 480px) 47vw, 92vw"
            className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.06] motion-reduce:group-hover:scale-100"
          />
        ) : (
          <span aria-hidden="true" className="flex h-full items-center justify-center bg-gradient-to-br from-brand-100 via-peach-50 to-berry-50 font-serif text-7xl text-ink/30">
            {title.charAt(0)}
          </span>
        )}

        <div className="absolute inset-x-3 top-3 flex items-start justify-between gap-2">
          {fileFormat ? (
            <span className="max-w-[60%] truncate rounded-full bg-white/90 px-2.5 py-1 text-xs font-medium text-ink shadow-sm backdrop-blur">{fileFormat}</span>
          ) : (
            <span />
          )}
          <span className="flex flex-col items-end gap-1.5">
            {discount > 0 && <span className="rounded-full bg-berry-500 px-2.5 py-1 text-xs font-semibold text-ink shadow-sm">−{discount}%</span>}
            {bestseller && (
              <span className="inline-flex items-center gap-1 rounded-full bg-brand-500 px-2.5 py-1 text-xs font-semibold text-ink shadow-sm">
                <Flame size={13} strokeWidth={2} aria-hidden="true" />
                Bestseller
              </span>
            )}
          </span>
        </div>

        {/* Hover hint (decorative: the whole card is already the link). */}
        <span
          aria-hidden="true"
          className="absolute bottom-3 left-3 inline-flex translate-y-2 items-center gap-1 rounded-full bg-ink px-3 py-1.5 text-xs font-medium text-white opacity-0 shadow-sm transition duration-300 group-hover:translate-y-0 group-hover:opacity-100"
        >
          View details
          <ArrowUpRight size={14} strokeWidth={2} />
        </span>
      </div>

      {/* ---------- Body ---------- */}
      <div className="flex flex-1 flex-col px-1 pt-4">
        {/* Meta row (always present, one line): category, then sales. Keeps every card's rows at the same height. */}
        <p className="flex h-5 min-w-0 items-center gap-2 text-xs text-stone-500">
          {category?.name && (
            <Link
              href={categoryHref(category)}
              className="relative z-10 inline-flex min-w-0 items-center gap-1.5 font-medium transition-colors hover:text-brand-700"
            >
              <CategoryIcon slug={(category.slugPath ?? category.slug).split('/')[0]} className="size-3.5 shrink-0" />
              <span className="truncate">{category.name}</span>
            </Link>
          )}
          {category?.name && salesCount > 0 && <span aria-hidden="true" className="size-1 shrink-0 rounded-full bg-stone-300" />}
          {salesCount > 0 && (
            <span className="inline-flex shrink-0 items-center gap-1">
              <Download size={12} strokeWidth={2} aria-hidden="true" />
              {salesCount.toLocaleString('en-US')} {price === 0 ? 'downloads' : 'sold'}
            </span>
          )}
        </p>

        {/* Title and description always take two lines each, so prices and buttons line up across a row. */}
        <h3 className="mt-2 line-clamp-2 min-h-[2lh] font-serif text-[1.25rem] leading-[1.2] tracking-[-0.015em] text-ink">
          <Link
            href={href}
            className="after:absolute after:inset-0 after:rounded-[1.4rem] focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-offset-4 focus-visible:after:outline-brand-700"
          >
            {title}
          </Link>
        </h3>
        <p className="mt-1.5 line-clamp-2 min-h-[2lh] text-sm leading-relaxed text-stone-500">{shortDescription}</p>

        {/* ---------- Price + add ---------- */}
        <div className="mt-3.5 flex h-14 items-center justify-between gap-3 border-t border-dashed border-stone-200 pt-3">
          <p className="flex items-baseline gap-2">
            <span className="font-serif text-[1.45rem] leading-none tracking-[-0.02em] text-ink tabular-nums">{price === 0 ? 'Free' : formatPrice(price, currency)}</span>
            {discount > 0 && <span className="text-sm text-stone-400 line-through tabular-nums">{formatPrice(compareAtPrice, currency)}</span>}
          </p>
          {/* Pass only what the cart needs to keep the client payload small. */}
          <AddToCartButton compact className="relative z-10" product={{ _id, slug, title, price, currency, coverImage, accessLink: isAccessLink({ deliveryType, fileFormat }) }} />
        </div>
      </div>
    </article>
  );
}
