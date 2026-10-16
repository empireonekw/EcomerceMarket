import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import ProductGrid from '@/components/ProductGrid';
import AddToCartButton from '@/components/AddToCartButton';
import BuyNowButton from '@/components/BuyNowButton';
import { getProductBySlug, getRelatedProducts } from '@/lib/data/products';
import { formatFileSize, formatPrice, NEUTRAL_BLUR_DATA_URL } from '@/lib/utils';
import { siteConfig } from '@/lib/site';

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

  const description = (product.shortDescription || product.description).slice(0, 160);
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

function productJsonLd(product) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.title,
    description: product.shortDescription || product.description.slice(0, 300),
    image: product.coverImage ? [product.coverImage] : undefined,
    sku: product._id,
    category: product.category?.name,
    offers: {
      '@type': 'Offer',
      url: `${siteConfig.url}/products/${product.slug}`,
      priceCurrency: product.currency,
      price: (product.price / 100).toFixed(2),
      availability: 'https://schema.org/InStock',
    },
  };
}

const TRUST = [
  { label: 'Instant download', d: 'M13 2 4 14h7l-1 8 9-12h-7l1-8Z' },
  { label: 'Secure checkout', d: 'M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3' },
  { label: 'Lifetime access', d: 'M12 3v12m0 0-4-4m4 4 4-4M5 19h14' },
];

export default async function ProductPage({ params }) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();

  const related = await getRelatedProducts(product, 3);
  const fileSize = formatFileSize(product.fileSize);
  const discount =
    product.compareAtPrice > product.price ? Math.round((1 - product.price / product.compareAtPrice) * 100) : 0;
  const cartProduct = {
    _id: product._id,
    slug: product.slug,
    title: product.title,
    price: product.price,
    currency: product.currency,
    coverImage: product.coverImage,
  };

  return (
    <div className="container-page py-8 sm:py-12">
      <script
        type="application/ld+json"
        // Escape "<" so product text can never close the script tag.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd(product)).replace(/</g, '\\u003c') }}
      />

      <nav aria-label="Breadcrumb" className="text-sm text-stone-500">
        <ol className="flex flex-wrap items-center gap-1.5">
          <li>
            <Link href="/products" className="hover:text-ink">
              Products
            </Link>
          </li>
          {product.category && (
            <>
              <li aria-hidden="true">/</li>
              <li>
                <Link href={`/products?category=${product.category.slug}`} className="hover:text-ink">
                  {product.category.name}
                </Link>
              </li>
            </>
          )}
        </ol>
      </nav>

      <div className="mt-6 grid gap-8 lg:grid-cols-[1.4fr_1fr] lg:gap-12">
        {/* ---------- Cover ---------- */}
        <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-stone-200 bg-stone-100">
          {product.coverImage ? (
            <Image
              src={product.coverImage}
              alt={product.title}
              fill
              preload // LCP element
              placeholder="blur"
              blurDataURL={product.coverBlurDataURL || NEUTRAL_BLUR_DATA_URL}
              sizes="(min-width: 1280px) 720px, (min-width: 1024px) 58vw, 100vw"
              className="object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center bg-stone-100 text-7xl font-medium text-stone-400">
              {product.title.charAt(0)}
            </div>
          )}
        </div>

        {/* ---------- Buy box ---------- */}
        <div className="lg:sticky lg:top-24 lg:self-start">
          {product.category && (
            <Link
              href={`/products?category=${product.category.slug}`}
              className="inline-flex rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700 hover:bg-brand-100"
            >
              {product.category.name}
            </Link>
          )}
          <h1 className="headline mt-4 text-4xl leading-[1.1] text-balance sm:text-5xl">{product.title}</h1>
          {product.shortDescription && <p className="mt-3 text-lg text-stone-600 text-pretty">{product.shortDescription}</p>}

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <span className="headline text-4xl tabular-nums">
              {product.price === 0 ? 'Free' : formatPrice(product.price, product.currency)}
            </span>
            {discount > 0 && (
              <>
                <span className="text-stone-500 line-through">{formatPrice(product.compareAtPrice, product.currency)}</span>
                <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-sm font-medium text-emerald-700">
                  Save {discount}%
                </span>
              </>
            )}
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            <BuyNowButton product={cartProduct} />
            <AddToCartButton product={cartProduct} />
          </div>

          <ul className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm text-stone-600">
            {TRUST.map((t) => (
              <li key={t.label} className="flex items-center gap-1.5">
                <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4 text-black" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d={t.d} />
                </svg>
                {t.label}
              </li>
            ))}
          </ul>

          <dl className="mt-8 divide-y divide-stone-200 rounded-2xl border border-stone-200 bg-white text-sm">
            <div className="flex justify-between gap-4 px-4 py-3">
              <dt className="text-stone-500">Delivery</dt>
              <dd className="font-medium">{product.deliveryType === 'external' ? 'Private access link' : 'Instant download'}</dd>
            </div>
            {product.fileFormat && (
              <div className="flex justify-between gap-4 px-4 py-3">
                <dt className="text-stone-500">Format</dt>
                <dd className="text-right font-medium">{product.fileFormat}</dd>
              </div>
            )}
            {fileSize && (
              <div className="flex justify-between gap-4 px-4 py-3">
                <dt className="text-stone-500">Size</dt>
                <dd className="font-medium">{fileSize}</dd>
              </div>
            )}
            {product.salesCount > 0 && (
              <div className="flex justify-between gap-4 px-4 py-3">
                <dt className="text-stone-500">Sales</dt>
                <dd className="font-medium">{product.salesCount.toLocaleString('en-US')}</dd>
              </div>
            )}
          </dl>
        </div>
      </div>

      {/* ---------- Description + tags ---------- */}
      <section className="mt-20 max-w-3xl" aria-labelledby="about-heading">
        <h2 id="about-heading" className="headline text-3xl">
          About this product
        </h2>
        <div className="mt-4 whitespace-pre-line leading-relaxed text-stone-700">{product.description}</div>

        {product.tags?.length > 0 && (
          <ul className="mt-6 flex flex-wrap gap-2" aria-label="Tags">
            {product.tags.map((tag) => (
              <li key={tag}>
                <Link
                  href={`/products?tag=${encodeURIComponent(tag)}`}
                  className="rounded-full bg-stone-100 px-3 py-1 text-xs font-medium text-stone-600 hover:bg-stone-200"
                >
                  #{tag}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ---------- Related ---------- */}
      {related.length > 0 && (
        <section className="mt-24" aria-labelledby="related-heading">
          <div className="flex items-end justify-between gap-4">
            <h2 id="related-heading" className="headline text-3xl">
              You might also like
            </h2>
            <Link href={`/products?category=${product.category?.slug}`} className="btn btn-md btn-outline">
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
