import Image from 'next/image';
import Link from '@/components/PrefetchLink';
import { ArrowRight, Award, Download, Link2, Star } from 'lucide-react';
import AddToCartButton from '@/components/AddToCartButton';
import VerifiedBadge from '@/components/VerifiedBadge';
import { formatPrice, isAccessLink, NEUTRAL_BLUR_DATA_URL } from '@/lib/utils';
import { categoryHref } from '@/lib/category-tree';

// Earned, not hand-picked: products with at least this many sales get the "Bestseller" badge.
const BESTSELLER_MIN_SALES = 250;
const compact = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });

/**
 * Server Component. Only the Add button ships client JS (plus the hover prefetch of the links).
 * Marketplace card, big and portrait: the cover fills a 4:5 frame (the whole image shown, on a blurred copy of itself),
 * a badge on it; then the delivery line, a one-line title, rating and shop, price with any discount, and
 * "Add to cart" · "More like this". Every row is always there, so cards in a row are the same height.
 * The title link is stretched over the whole card; the buttons sit above it. Laid out by its own width (@container).
 * Pass `preload` only for above-the-fold cards (first row) to improve LCP. `showShop={false}` (on a shop's own page)
 * leaves out the rating and "By shop" row, for every card alike.
 */
export default function ProductCard({ product, preload = false, showShop = true }) {
  const {
    _id,
    title,
    slug,
    price,
    compareAtPrice,
    currency,
    coverImage,
    coverBlurDataURL,
    category,
    fileFormat,
    deliveryType,
    salesCount,
    rating,
    shop,
  } = product;
  const href = `/products/${slug}`;
  const discount = compareAtPrice > price ? Math.round((1 - price / compareAtPrice) * 100) : 0;
  // A big seller on its own, or from a shop with 5+ sales in total (lib/data/products.js withCardDetails).
  const bestseller = salesCount >= BESTSELLER_MIN_SALES || Boolean(shop?.bestSeller);
  const accessLink = isAccessLink({ deliveryType, fileFormat });
  const sizes = '(min-width: 640px) 340px, 48vw';

  return (
    <article className="group @container relative flex h-full flex-col">
      {/* ---------- Cover ---------- */}
      <div className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-stone-100 ring-1 ring-black/5 transition-shadow duration-300 group-hover:shadow-[0_18px_40px_-20px_rgba(20,20,20,0.45)]">
        {coverImage ? (
          <>
            {/* The same image (same URL, so no extra download), blurred, fills the frame around the uncropped one. */}
            <Image src={coverImage} alt="" aria-hidden="true" fill sizes={sizes} className="scale-110 object-cover opacity-60 blur-2xl" />
            <Image
              src={coverImage}
              alt=""
              fill
              preload={preload}
              placeholder="blur"
              blurDataURL={coverBlurDataURL || NEUTRAL_BLUR_DATA_URL}
              sizes={sizes}
              className="object-contain transition-transform duration-500 ease-out group-hover:scale-[1.03] motion-reduce:group-hover:scale-100"
            />
          </>
        ) : (
          <span
            aria-hidden="true"
            className="flex h-full items-center justify-center bg-gradient-to-br from-brand-100 via-peach-50 to-berry-50 font-serif text-7xl text-ink/30"
          >
            {title.charAt(0)}
          </span>
        )}

        {fileFormat && (
          <span className="absolute top-3 left-3 max-w-[70%] truncate rounded-full bg-white px-3 py-1 text-xs font-semibold text-ink shadow-sm @[17rem]:text-sm">
            {fileFormat}
          </span>
        )}
        {bestseller && (
          <span className="absolute right-3 bottom-3 inline-flex items-center gap-1 rounded-full bg-amber-400 px-2.5 py-1 text-xs font-semibold text-amber-950 shadow-[0_6px_16px_-6px_rgba(180,110,0,0.7)] ring-1 ring-amber-500/40 @[17rem]:text-sm">
            <Award size={14} strokeWidth={2.25} aria-hidden="true" />
            Best seller
          </span>
        )}
      </div>

      {/* ---------- Details (every row always present: equal heights) ---------- */}
      <div className="flex flex-1 flex-col pt-3">
        <p className="flex items-center gap-1.5 text-[13px] text-stone-500 @[17rem]:text-sm">
          {accessLink ? <Link2 size={15} strokeWidth={2} aria-hidden="true" /> : <Download size={15} strokeWidth={2} aria-hidden="true" />}
          {accessLink ? 'Instant access' : 'Digital download'}
        </p>

        <h3 className="mt-0.5 truncate text-[15px] leading-snug text-ink @[17rem]:text-base" title={title}>
          <Link
            href={href}
            className="after:absolute after:inset-0 after:rounded-2xl focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-offset-4 focus-visible:after:outline-brand-700"
          >
            {title}
          </Link>
        </h3>

        {showShop && (
          <p className="mt-1 flex min-w-0 items-center gap-1 text-[13px] text-stone-600 @[17rem]:text-sm">
            {rating?.count > 0 && (
              <>
                <span className="font-semibold text-ink tabular-nums">{rating.average.toFixed(1)}</span>
                <Star size={14} aria-hidden="true" className="shrink-0 fill-ink text-ink" />
                <span className="tabular-nums">({compact.format(rating.count)})</span>
                <span aria-hidden="true" className="px-0.5">
                  ·
                </span>
              </>
            )}
            <span className="truncate">By {shop?.name ?? 'Sellpify'}</span>
            {shop?.verified && <VerifiedBadge size={14} />}
          </p>
        )}

        <p className="mt-1.5 flex flex-wrap items-baseline gap-x-1.5">
          <span
            className={`text-lg font-semibold tracking-[-0.01em] tabular-nums @[17rem]:text-xl ${discount > 0 ? 'text-emerald-700' : 'text-ink'}`}
          >
            {price === 0 ? 'Free' : formatPrice(price, currency)}
          </span>
          {discount > 0 && (
            <>
              <span className="text-sm text-stone-500 line-through tabular-nums">{formatPrice(compareAtPrice, currency)}</span>
              <span className="text-sm text-stone-600">({discount}% off)</span>
            </>
          )}
        </p>

        {/* Pushed to the bottom, so the buttons line up across a row. */}
        <div className="mt-auto flex items-center gap-4 pt-3">
          {/* Pass only what the cart needs to keep the client payload small. */}
          <AddToCartButton outlined className="relative z-10" product={{ _id, slug, title, price, currency, coverImage, accessLink }} />
          {category && (
            <Link
              href={categoryHref(category)}
              className="relative z-10 hidden items-center gap-1.5 text-sm font-semibold whitespace-nowrap text-ink hover:underline @[17rem]:inline-flex"
            >
              More like this
              <ArrowRight size={16} strokeWidth={2} aria-hidden="true" />
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}
