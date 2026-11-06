import Link from '@/components/PrefetchLink';
import { notFound } from 'next/navigation';
import { BadgeCheck, Check, ChevronRight, Download, FileText, Layers, Lock, MapPin, RefreshCw, Scale, ShoppingBag, Star, Tag } from 'lucide-react';
import BackLink from '@/components/BackLink';
import ExpandableText from '@/components/ExpandableText';
import ProductGallery from '@/components/ProductGallery';
import ProductGrid from '@/components/ProductGrid';
import RichText from '@/components/RichText';
import AddToCartButton from '@/components/AddToCartButton';
import BuyNowButton from '@/components/BuyNowButton';
import MessageSellerButton from '@/components/messages/MessageSellerButton';
import VerifiedBadge from '@/components/VerifiedBadge';
import Stars from '@/components/Stars';
import ProductReviews from '@/components/reviews/ProductReviews';
import { getProductReviews, getProductReviewSummary } from '@/lib/data/reviews';
import ProductViewTracker from '@/components/ProductViewTracker';
import { getProductBySlug, getRelatedProducts, getShopSummary } from '@/lib/data/products';
import { getCategories } from '@/lib/data/categories';
import { countryOf } from '@/lib/seller-onboarding';
import { deliveryLabel, formatFileSize, formatPrice, isAccessLink, tagHref } from '@/lib/utils';
import { LICENSES, labelOf } from '@/lib/listing';
import { stripRichText } from '@/lib/rich-text';
import { siteConfig } from '@/lib/site';
import { categoryHref } from '@/lib/category-tree';

// ISR: rendered on first visit, served from cache, refreshed at most every 5 minutes.
export const revalidate = 300;

export async function generateStaticParams() {
  // Empty list = no DB access at build time; every slug is generated on demand and then cached.
  // To pre-render best sellers at build, return e.g. the top 50 slugs by salesCount.
  return [];
}

// getProductBySlug is wrapped in React cache(), so metadata + page share ONE MongoDB query.
export async function generateMetadata({ params }) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return { title: 'Product not found', robots: { index: false } };

  const description = (product.shortDescription || stripRichText(product.description)).slice(0, 160);
  const images = product.coverImage ? [{ url: product.coverImage, alt: product.title }] : undefined;
  return {
    title: product.title,
    description,
    keywords: product.tags,
    alternates: { canonical: `/products/${product.slug}` },
    openGraph: { type: 'website', title: product.title, description, url: `/products/${product.slug}`, images },
    twitter: { card: 'summary_large_image', title: product.title, description, images: images?.map((i) => i.url) },
  };
}

function productJsonLd(product, reviews) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.title,
    description: product.shortDescription || stripRichText(product.description).slice(0, 300),
    image: product.images?.length ? product.images : product.coverImage ? [product.coverImage] : undefined,
    sku: product._id,
    category: product.category?.name,
    offers: {
      '@type': 'Offer',
      url: `${siteConfig.url}/products/${product.slug}`,
      priceCurrency: product.currency,
      price: (product.price / 100).toFixed(2),
      availability: 'https://schema.org/InStock',
    },
    // Star rating in search results, once there are reviews.
    ...(reviews.count > 0 && {
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: reviews.average.toFixed(1),
        reviewCount: reviews.count,
        bestRating: 5,
        worstRating: 1,
      },
    }),
  };
}

/** "3 months" / "2 years" on Sellpify. */
function timeOn(since) {
  const months = since ? Math.max(1, Math.round((Date.now() - new Date(since)) / (30.44 * 86_400_000))) : 0;
  if (!months) return null;
  return months < 12 ? `${months} month${months === 1 ? '' : 's'}` : `${Math.floor(months / 12)} year${months >= 24 ? 's' : ''}`;
}

/** "Includes 300 sales and 40 reviews from the seller's other shop, checked by Sellpify." (imported totals) */
function importedNote({ sales, reviews }) {
  const parts = [sales > 0 && `${sales.toLocaleString('en-US')} sale${sales === 1 ? '' : 's'}`, reviews > 0 && `${reviews} review${reviews === 1 ? '' : 's'}`].filter(Boolean);
  return `Includes ${parts.join(' and ')} from the seller’s other shop, checked by ${siteConfig.name}.`;
}

const fmtDate = (d) => new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

/** One row of the right column's "Highlights" / "Delivery" lists: an icon and text. */
function Fact({ icon: Icon, children }) {
  return (
    <li className="flex gap-3">
      <Icon size={20} strokeWidth={1.75} aria-hidden="true" className="mt-0.5 shrink-0 text-ink" />
      <span className="min-w-0 text-[15px] leading-relaxed text-stone-700">{children}</span>
    </li>
  );
}

/**
 * Product page, marketplace layout: breadcrumbs on top; photos (thumbnails on the left) beside the buy box; under the
 * photos the reviews and the seller; under the buy box the highlights, description and delivery; related items last.
 */
export default async function ProductPage({ params }) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();

  const [related, shop, reviewSummary, firstReviews, categories] = await Promise.all([
    getRelatedProducts(product, 4), // one row of the grid on a laptop
    getShopSummary(product.sellerId),
    getProductReviewSummary(product._id),
    getProductReviews(product._id),
    getCategories(),
  ]);
  const byId = new Map(categories.map((c) => [String(c._id), c]));
  const leaf = product.category && byId.get(String(product.category._id));
  const trail = leaf ? [...leaf.ancestors.map((id) => byId.get(String(id))).filter(Boolean), leaf] : [];
  const fileSize = formatFileSize(product.fileSize);
  const discount = product.compareAtPrice > product.price ? Math.round((1 - product.price / product.compareAtPrice) * 100) : 0;
  const accessLink = isAccessLink(product);
  const cartProduct = {
    _id: product._id,
    slug: product.slug,
    title: product.title,
    price: product.price,
    currency: product.currency,
    coverImage: product.coverImage,
    accessLink,
  };
  const intro = String(product.description ?? '').split(/\n\s*\n/)[0].trim(); // first paragraph, for the buy box
  const photos = product.images?.length ? product.images : [product.coverImage].filter(Boolean);
  const country = shop?.country && countryOf(shop.country)?.name;
  const shopAge = timeOn(shop?.since);

  return (
    <div className="container-page py-6 sm:py-10">
      <ProductViewTracker productId={String(product._id)} />
      <script
        type="application/ld+json"
        // Escape "<" so product text can never close the script tag.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd(product, reviewSummary)).replace(/</g, '\\u003c') }}
      />

      {/* ---------- Top navigation: Back + breadcrumbs (centred on large screens) ---------- */}
      <div className="relative flex items-center gap-3 lg:justify-center">
        <BackLink fallback={leaf ? categoryHref(leaf) : '/products'} className="lg:absolute lg:left-0" />
        <nav aria-label="Breadcrumb" className="min-w-0">
          <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm">
            <li>
              <Link href="/" className="font-medium text-ink underline-offset-4 hover:underline">
                Home
              </Link>
            </li>
            {(trail.length ? trail : [{ _id: 'all', name: 'All products', href: '/products' }]).map((c) => (
              <li key={c._id} className="flex items-center gap-1.5">
                <ChevronRight size={14} strokeWidth={2} aria-hidden="true" className="text-stone-400" />
                <Link href={c.href ?? categoryHref(c)} className="font-medium text-ink underline-offset-4 hover:underline">
                  {c.name}
                </Link>
              </li>
            ))}
          </ol>
        </nav>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-x-12 gap-y-10 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] lg:grid-rows-[auto_1fr] xl:gap-x-16">
        {/* ---------- Photos ---------- */}
        <div className="min-w-0 lg:col-start-1 lg:row-start-1">
          <ProductGallery images={photos} videos={product.videos ?? []} title={product.title} coverBlurDataURL={product.coverBlurDataURL} />
        </div>

        {/* ---------- Right column: buy box, highlights, description, delivery ---------- */}
        <div className="min-w-0 lg:col-start-2 lg:row-span-2 lg:row-start-1">
          <h1 className="font-serif text-[1.75rem] leading-[1.15] tracking-[-0.015em] text-ink text-balance sm:text-[2rem]">{product.title}</h1>

          <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <span className="text-[1.75rem] font-semibold tracking-[-0.02em] text-ink tabular-nums">
              {product.price === 0
                ? 'Free'
                : discount > 0
                  ? `Now ${formatPrice(product.price, product.currency)}`
                  : formatPrice(product.price, product.currency)}
            </span>
            {discount > 0 && (
              <>
                <span className="text-lg text-stone-500 line-through tabular-nums">{formatPrice(product.compareAtPrice, product.currency)}</span>
                <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-sm font-semibold text-emerald-800">{discount}% off</span>
              </>
            )}
          </div>
          {product.price > 0 && <p className="mt-1 text-sm text-stone-500">Taxes, if any, are shown at checkout.</p>}

          {/* Shop and rating */}
          <p className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-[15px]">
            {shop ? (
              <Link href={`/shop/${shop.id}`} className="flex items-center gap-1 font-semibold text-ink underline-offset-4 hover:underline">
                {shop.name}
                {shop.verified && <VerifiedBadge size={15} />}
              </Link>
            ) : (
              <span className="font-semibold text-ink">{siteConfig.name}</span>
            )}
            {reviewSummary.count > 0 ? (
              <a href="#reviews" className="inline-flex items-center gap-1.5 text-stone-600 hover:text-ink">
                <Stars rating={reviewSummary.average} size={14} />
                <span className="underline underline-offset-2">({reviewSummary.count})</span>
              </a>
            ) : (
              shop?.rating.count > 0 && <Stars rating={shop.rating.average} size={14} />
            )}
          </p>

          <ul className="mt-4 space-y-2 text-[15px] text-stone-700">
            <li className="flex items-center gap-2.5">
              <Check size={18} strokeWidth={2.25} aria-hidden="true" className="shrink-0 text-sky-700" />
              {accessLink ? 'Instant access: your link is ready the moment you pay' : 'Instant download: your files are ready the moment you pay'}
            </li>
            <li className="flex items-center gap-2.5">
              <Check size={18} strokeWidth={2.25} aria-hidden="true" className="shrink-0 text-sky-700" />
              Yours to keep: download again any time from Purchases
            </li>
            <li className="flex items-center gap-2.5">
              <Check size={18} strokeWidth={2.25} aria-hidden="true" className="shrink-0 text-sky-700" />
              Secure checkout
            </li>
          </ul>

          {/* A taste of the description right above the buttons: the seller's summary, or the description's first
              paragraph with its formatting (bold etc.), cut to three lines. The full text is further down. */}
          {(product.shortDescription || intro) && (
            <div className="mt-6 rounded-2xl bg-stone-50 px-4 py-3.5">
              {product.shortDescription ? (
                <p className="line-clamp-3 text-[15px] leading-relaxed text-stone-700">{product.shortDescription}</p>
              ) : (
                <RichText text={intro} className="line-clamp-3 text-[15px] leading-relaxed text-stone-700" />
              )}
              <a href="#about" className="mt-1.5 inline-block text-sm font-semibold text-ink underline-offset-4 hover:underline">
                Read the full description
              </a>
            </div>
          )}

          <div className="mt-6 space-y-3">
            <BuyNowButton product={cartProduct} />
            <AddToCartButton product={cartProduct} />
          </div>

          {/* ---------- Highlights ---------- */}
          <section className="mt-10" aria-labelledby="highlights-heading">
            <h2 id="highlights-heading" className="text-lg font-semibold text-ink">
              Highlights
            </h2>
            <ul className="mt-4 space-y-3.5">
              <Fact icon={Download}>{deliveryLabel(product)}</Fact>
              {product.fileFormat && <Fact icon={FileText}>Format: {product.fileFormat}</Fact>}
              {fileSize && <Fact icon={Layers}>Size: {fileSize}</Fact>}
              {product.license && <Fact icon={Scale}>Licence: {labelOf(LICENSES, product.license)}</Fact>}
              {product.salesCount > 0 && (
                <Fact icon={ShoppingBag}>
                  {product.salesCount.toLocaleString('en-US')} {product.price === 0 ? 'downloads' : 'sold'}
                </Fact>
              )}
              {leaf && (
                <Fact icon={Tag}>
                  Category:{' '}
                  <Link href={categoryHref(leaf)} className="underline underline-offset-2 hover:text-ink">
                    {leaf.path ?? leaf.name}
                  </Link>
                </Fact>
              )}
            </ul>
          </section>

          {/* ---------- Description ---------- */}
          <section id="about" className="mt-10 scroll-mt-28 border-t border-stone-200 pt-8" aria-labelledby="about-heading">
            <h2 id="about-heading" className="text-lg font-semibold text-ink">
              About this item
            </h2>
            <div className="mt-3">
              <ExpandableText>
                <RichText text={product.description} className="text-[15px] leading-relaxed text-stone-700" />
                {product.tags?.length > 0 && (
                  <ul className="mt-5 flex flex-wrap gap-2" aria-label="Tags">
                    {product.tags.map((tag) => (
                      <li key={tag}>
                        <Link
                          href={tagHref(tag)}
                          className="rounded-full bg-stone-100 px-3 py-1 text-xs font-medium text-stone-600 hover:bg-stone-200"
                        >
                          #{tag}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </ExpandableText>
            </div>
          </section>

          {/* ---------- Delivery ---------- */}
          <section className="mt-10 border-t border-stone-200 pt-8" aria-labelledby="delivery-heading">
            <h2 id="delivery-heading" className="text-lg font-semibold text-ink">
              Delivery
            </h2>
            <ul className="mt-4 space-y-3.5">
              <Fact icon={Download}>
                {accessLink ? 'Access link delivered instantly after payment' : 'Digital files delivered instantly after payment'}
              </Fact>
              <Fact icon={RefreshCw}>Lifetime access from your Purchases page</Fact>
              <Fact icon={Lock}>Secure checkout: cards, JazzCash, Easypaisa and bank transfer</Fact>
              {country && <Fact icon={MapPin}>Made by a creator in {country}</Fact>}
            </ul>
          </section>
        </div>

        {/* ---------- Under the photos: reviews, then the seller ---------- */}
        <div className="min-w-0 lg:col-start-1 lg:row-start-2">
          <ProductReviews productId={product._id} productTitle={product.title} summary={reviewSummary} initial={firstReviews} />

          {shop ? (
            <section className="mt-10 rounded-2xl border border-stone-200 bg-white p-5 sm:p-7" aria-labelledby="seller-heading">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
                {shop.logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={shop.logo} alt="" className="size-20 shrink-0 rounded-2xl object-cover" />
                ) : (
                  <span
                    aria-hidden="true"
                    className="grid size-20 shrink-0 place-items-center rounded-2xl bg-brand-100 font-serif text-3xl text-brand-800"
                  >
                    {shop.name.charAt(0)}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium uppercase tracking-wide text-stone-500">Meet the seller</p>
                  <h2 id="seller-heading" className="mt-0.5 flex items-center gap-1.5 font-serif text-2xl text-ink">
                    <Link href={`/shop/${shop.id}`} className="truncate underline-offset-4 hover:underline">
                      {shop.name}
                    </Link>
                    {shop.verified && <VerifiedBadge size={20} />}
                    {country && <span className="font-sans text-sm font-normal text-stone-500">· {country}</span>}
                  </h2>
                  <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-stone-700">
                    {shop.rating.count > 0 && (
                      <span className="inline-flex items-center gap-1 font-medium">
                        <Star size={14} aria-hidden="true" className="fill-ink text-ink" />
                        {shop.rating.average.toFixed(1)} ({shop.rating.count})
                      </span>
                    )}
                    {shop.rating.count > 0 && <span aria-hidden="true">·</span>}
                    <span className="font-medium">
                      {shop.sales.toLocaleString('en-US')} sale{shop.sales === 1 ? '' : 's'}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>
                      {shop.listings} listing{shop.listings === 1 ? '' : 's'}
                    </span>
                    {shopAge && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>
                          {shopAge} on {siteConfig.name}
                        </span>
                      </>
                    )}
                  </p>
                  {(shop.imported.sales > 0 || shop.imported.reviews > 0) && (
                    <p className="mt-1.5 text-xs text-stone-500">{importedNote(shop.imported)}</p>
                  )}
                  {shop.verified && (
                    <p className="mt-2 inline-flex items-center gap-1.5 text-sm text-sky-800">
                      <BadgeCheck size={15} strokeWidth={2} aria-hidden="true" />
                      Identity verified by {siteConfig.name}
                    </p>
                  )}
                  {shop.description && <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-stone-600">{shop.description}</p>}
                </div>
                <div className="flex shrink-0 flex-col gap-2 sm:w-44">
                  <Link href={`/shop/${shop.id}`} className="btn btn-md btn-dark w-full">
                    Visit shop
                  </Link>
                  <MessageSellerButton
                    product={{ id: product._id, slug: product.slug, title: product.title, coverImage: product.coverImage }}
                    shop={{ id: shop.id, name: shop.name, verified: shop.verified }}
                  />
                </div>
              </div>

              {/* Nothing on this item yet: what buyers said about the shop's other items. */}
              {reviewSummary.count === 0 && shop.recentReviews.length > 0 && (
                <div className="mt-7 border-t border-stone-200 pt-6">
                  <h3 className="text-lg font-semibold text-ink">Reviews from this shop ({shop.rating.count})</h3>
                  <ul className="mt-4 grid gap-4 sm:grid-cols-2">
                    {shop.recentReviews.map((r) => (
                      <li key={r._id} className="flex flex-col rounded-xl border border-stone-200 p-4">
                        <Stars rating={r.rating} size={15} />
                        <p className="mt-2 line-clamp-4 flex-1 text-sm leading-relaxed text-stone-700">{r.body}</p>
                        <p className="mt-3 text-xs text-stone-500">
                          <span className="font-medium text-stone-700">{r.authorName}</span> · {fmtDate(r.createdAt)}
                        </p>
                        {r.imported ? (
                          <p className="mt-1.5">
                            <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-600">From the seller’s other shop</span>
                          </p>
                        ) : (
                          <p className="mt-0.5 truncate text-xs text-stone-500">
                            Purchased:{' '}
                            <Link href={`/products/${r.productSlug}`} className="underline underline-offset-2 hover:text-ink">
                              {r.productTitle}
                            </Link>
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          ) : (
            <p className="mt-10 rounded-2xl border border-stone-200 bg-white p-5 text-sm text-stone-600">
              Sold by {siteConfig.name}. Questions?{' '}
              <Link href="/contact" className="font-medium text-ink underline underline-offset-2">
                Contact us
              </Link>
            </p>
          )}
        </div>
      </div>

      {/* ---------- Related ---------- */}
      {related.length > 0 && (
        <section className="mt-20" aria-labelledby="related-heading">
          <div className="flex items-end justify-between gap-4">
            <h2 id="related-heading" className="headline text-3xl">
              You might also like
            </h2>
            <Link href={leaf ? categoryHref(leaf) : '/products'} className="btn btn-md btn-outline">
              View all
            </Link>
          </div>
          <div className="mt-8">
            <ProductGrid products={related} />
          </div>
        </section>
      )}
    </div>
  );
}
