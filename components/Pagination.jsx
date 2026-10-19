import Link from 'next/link';
import LinkPending from '@/components/LinkPending';

function buildHref(basePath, params, page) {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value != null && value !== '' && key !== 'page' && key !== 'limit') qs.set(key, value);
  }
  if (page > 1) qs.set('page', String(page));
  const s = qs.toString();
  return s ? `${basePath}?${s}` : basePath;
}

/** Windowed page list: 1 … 4 5 [6] 7 8 … 20 */
function pageWindow(current, total) {
  const pages = new Set([1, total, current - 1, current, current + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  const out = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) out.push(`gap-${p}`);
    out.push(p);
  });
  return out;
}

export default function Pagination({ page, totalPages, basePath = '/products', params = {} }) {
  if (!totalPages || totalPages <= 1) return null;

  const base = 'grid h-10 min-w-10 place-items-center rounded-full px-3 text-sm font-medium transition-colors';
  const idle = `${base} border border-stone-300 bg-white hover:border-ink`;
  const disabled = `${base} border border-stone-200 text-stone-300`;

  return (
    <nav aria-label="Pagination" className="mt-12 flex flex-wrap items-center justify-center gap-2">
      {page > 1 ? (
        <Link href={buildHref(basePath, params, page - 1)} className={idle} rel="prev">
          <LinkPending replace>← Prev</LinkPending>
        </Link>
      ) : (
        <span className={disabled}>← Prev</span>
      )}

      {pageWindow(page, totalPages).map((p) =>
        typeof p === 'string' ? (
          <span key={p} className="px-1 text-stone-400">
            …
          </span>
        ) : p === page ? (
          <span key={p} aria-current="page" className={`${base} bg-ink text-white`}>
            {p}
          </span>
        ) : (
          <Link key={p} href={buildHref(basePath, params, p)} className={idle}>
            <LinkPending replace>{p}</LinkPending>
          </Link>
        ),
      )}

      {page < totalPages ? (
        <Link href={buildHref(basePath, params, page + 1)} className={idle} rel="next">
          <LinkPending replace>Next →</LinkPending>
        </Link>
      ) : (
        <span className={disabled}>Next →</span>
      )}
    </nav>
  );
}
