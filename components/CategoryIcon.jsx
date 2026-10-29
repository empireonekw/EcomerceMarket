// Inline SVG icons keyed by main-category slug — zero network requests, no icon library.
// Admins create their own categories; any slug without an icon here gets the grid fallback.
const PATHS = {
  'paper-party-supplies': (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" strokeLinejoin="round" />
    </>
  ),
  'art-collectibles': (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="9" cy="9.5" r="1.75" />
      <path d="m3 17 5-4.5 4 3.5 3-2.5 6 5" strokeLinejoin="round" />
    </>
  ),
  'craft-supplies-tools': (
    <>
      <circle cx="6" cy="6" r="2.5" />
      <circle cx="6" cy="18" r="2.5" />
      <path d="M8 7.5 20 17M8 16.5 20 7" strokeLinecap="round" />
    </>
  ),
  'books-movies-music': (
    <>
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5v-15Z" />
      <path d="M4 20.5A2.5 2.5 0 0 1 6.5 18H20v3H6.5" />
    </>
  ),
  'design-assets': (
    <>
      <path d="M12 3 4 20h16L12 3Z" strokeLinejoin="round" />
      <circle cx="12" cy="3" r="1.5" />
      <circle cx="4" cy="20" r="1.5" />
      <circle cx="20" cy="20" r="1.5" />
    </>
  ),
  'software-tools': (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="m8 10 2 2-2 2M13 14h3" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  'digital-products': (
    <>
      <path d="M12 4v10m0 0-4-4m4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" strokeLinecap="round" />
    </>
  ),
  'physical-products': (
    <>
      <path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z" strokeLinejoin="round" />
      <path d="m4 7.5 8 4.5 8-4.5M12 12v9" strokeLinejoin="round" />
    </>
  ),
  services: (
    <>
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18" />
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
