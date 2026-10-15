// Inline SVG icons keyed by category slug — zero network requests, no icon library.
const PATHS = {
  templates: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 9h18M9 9v11" />
    </>
  ),
  ebooks: (
    <>
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5v-15Z" />
      <path d="M4 20.5A2.5 2.5 0 0 1 6.5 18H20v3H6.5" />
    </>
  ),
  software: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="m8 10 2 2-2 2M13 14h3" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  'vector-packs': (
    <>
      <path d="M12 3 4 20h16L12 3Z" strokeLinejoin="round" />
      <circle cx="12" cy="3" r="1.5" />
      <circle cx="4" cy="20" r="1.5" />
      <circle cx="20" cy="20" r="1.5" />
    </>
  ),
};

const FALLBACK = (
  <>
    <rect x="4" y="4" width="7" height="7" rx="1.5" />
    <rect x="13" y="4" width="7" height="7" rx="1.5" />
    <rect x="4" y="13" width="7" height="7" rx="1.5" />
    <rect x="13" y="13" width="7" height="7" rx="1.5" />
  </>
);

export default function CategoryIcon({ slug, className = 'size-6' }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.6">
      {PATHS[slug] ?? FALLBACK}
    </svg>
  );
}
