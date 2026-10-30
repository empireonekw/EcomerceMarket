import Image from 'next/image';
import Link from 'next/link';
import { siteConfig } from '@/lib/site';
import logo from '@/assets/brand/sellpify-logo.svg';

/**
 * The logo image at `height` px. The size is set on the <img> itself (not only through CSS classes): the SVG's own
 * size is ~3000 px wide, so a page whose styles haven't loaded yet would otherwise show it huge and scroll sideways.
 */
export function LogoImage({ height = 40, className = '', eager = false }) {
  const width = Math.round((height * logo.width) / logo.height);
  return (
    <Image
      src={logo}
      alt=""
      width={width}
      height={height}
      unoptimized
      loading={eager ? 'eager' : 'lazy'}
      style={{ height, width: 'auto', maxWidth: 'none' }}
      className={`shrink-0 ${className}`}
    />
  );
}

/**
 * The Sellpify logo (handwritten name + gold-handled bag, assets/brand/sellpify-logo.svg) linking home. Used in the
 * header, footer, auth pages and seller onboarding. `eager` for the copy at the top of the page; `tagline` adds
 * "Shop independent creators" under it (footer).
 */
export default function Logo({ height = 40, className = '', eager = false, tagline = false }) {
  return (
    <Link href="/" className="inline-flex shrink-0 flex-col items-start" aria-label={`${siteConfig.name} home`}>
      <LogoImage height={height} className={className} eager={eager} />
      {tagline && <span className="mt-2 text-[11px] font-medium tracking-[0.28em] text-stone-600 uppercase">Shop independent creators</span>}
    </Link>
  );
}
