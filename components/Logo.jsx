import Link from 'next/link';
import { siteConfig } from '@/lib/site';

const [first, ...rest] = siteConfig.name.split(' ');

/** Wordmark used in the header, footer and auth pages: indigo dot · serif name (first word strong, the rest light). */
export default function Logo({ className = '' }) {
  return (
    <Link
      href="/"
      className={`flex shrink-0 items-center gap-2 whitespace-nowrap font-serif text-[1.375rem] leading-none tracking-tight ${className}`}
      aria-label={`${siteConfig.name} home`}
    >
      <span aria-hidden="true" className="size-2 rounded-full bg-brand-600" />
      <span>
        <span className="font-medium text-gray-900">{first}</span>
        {rest.length > 0 && <span className="ml-1 font-light text-stone-500">{rest.join(' ')}</span>}
      </span>
    </Link>
  );
}
