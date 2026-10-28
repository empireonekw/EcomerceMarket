// Work-related photos that fill the homepage hero gallery when there aren't enough live products with covers
// (free-to-use Unsplash photos, an allowed image host). Real products always come first (HeroShowcase.jsx).
const unsplash = (id) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=800&h=1000&q=80`;

export const HERO_FILLERS = [
  { src: unsplash('1609921212029-bb5a28e60960'), alt: 'Mobile app screens laid out on a desktop monitor', label: 'UI kits', href: '/products?category=templates' },
  { src: unsplash('1581291518857-4e27b48ff24e'), alt: 'Hand sketching an app wireframe on paper', label: 'Wireframes', href: '/products?category=templates' },
  { src: unsplash('1559028012-481c04fa702d'), alt: 'Website design shown on a large monitor', label: 'Website templates', href: '/products?category=templates' },
  { src: unsplash('1558655146-9f40138edfeb'), alt: 'Digital illustration being drawn on a tablet', label: 'Illustrations', href: '/products?category=vector-packs' },
  { src: unsplash('1561070791-2526d30994b5'), alt: 'Colour swatch cards spread across a designer’s desk', label: 'Brand kits', href: '/products?category=vector-packs' },
];
