import Link from 'next/link';

/** Pill link used for category and sort filters on product listings. */
export default function FilterChip({ href, active, children }) {
  return (
    <Link
      href={href}
      aria-current={active ? 'true' : undefined}
      className={`whitespace-nowrap rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
        active ? 'border-ink bg-ink text-white' : 'border-stone-300 bg-white text-stone-700 hover:border-ink'
      }`}
    >
      {children}
    </Link>
  );
}
