import Link from '@/components/PrefetchLink';

/** Pill link used for category and sort filters on product listings. */
export default function FilterChip({ href, active, children }) {
  return (
    <Link
      href={href}
      aria-current={active ? 'true' : undefined}
      className={`whitespace-nowrap rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
        active ? 'border-ink bg-ink text-white' : 'border-stone-300 bg-white text-stone-700 hover:border-ink'
      }`}
    >
      {children}
    </Link>
  );
}
