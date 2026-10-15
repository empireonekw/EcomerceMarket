import Link from 'next/link';
import { siteConfig } from '@/lib/site';

const [first, ...rest] = siteConfig.name.split(' ');

/** Wordmark used in the header, footer and auth pages: indigo dot · first word strong · the rest light. `tone="light"` for dark backgrounds. */
export default function Logo({ className = '', tone = 'dark' }) {
  const light = tone === 'light';
  return (
    <Link
      href="/"
      className={`flex shrink-0 items-center gap-2 whitespace-nowrap text-lg leading-none tracking-[-0.01em] ${className}`}
      aria-label={`${siteConfig.name} home`}
    >
      <span aria-hidden="true" className="size-2 rounded-full bg-brand-600" />
      <span>
        <span className={`font-[560] ${light ? 'text-white' : 'text-black'}`}>{first}</span>
        {rest.length > 0 && <span className={`ml-1 font-[320] ${light ? 'text-white/60' : 'text-stone-500'}`}>{rest.join(' ')}</span>}
      </span>
    </Link>
  );
}
