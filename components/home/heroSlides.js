// Handmade, Etsy-style photos shown in the homepage hero gallery: crochet, books, bags, jewelry, pottery, candles
// and macramé (free-to-use Unsplash photos, an allowed image host).
const unsplash = (id) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=800&h=1000&q=80`;

export const HERO_SLIDES = [
  { src: unsplash('1648005539099-709d5be525fb'), alt: 'Balls of yarn and a crochet hook on a blanket' },
  { src: unsplash('1593430980369-68efc5a5eb34'), alt: 'Books lined up on a wooden bookshelf' },
  { src: unsplash('1777283316185-9eff9eac098c'), alt: 'Colourful handmade bags hanging on display' },
  { src: unsplash('1700171518313-5dd219beaaa6'), alt: 'Crocheted flowers on a blue surface' },
  { src: unsplash('1597696929736-6d13bed8e6a8'), alt: 'Handmade ceramic vases in neutral tones' },
  { src: unsplash('1766560360281-d3c264734a1f'), alt: 'Colourful beaded bracelets arranged in a row' },
  { src: unsplash('1777896067223-9990008a07d7'), alt: 'Cosy living room with a large bookshelf' },
  { src: unsplash('1613068431228-8cb6a1e92573'), alt: 'Lit pillar candles surrounded by eucalyptus leaves' },
  { src: unsplash('1617636521236-db69104aa220'), alt: 'Patterned canvas tote bag' },
  { src: unsplash('1728393287642-13bee7126ae8'), alt: 'A crocheted blanket and a crochet kit on a bed' },
  { src: unsplash('1633594308237-3dcfa56b4e69'), alt: 'Macramé plant hanger on a wall' },
  { src: unsplash('1573227890085-12ab5d68a170'), alt: 'Handmade leather teardrop earrings' },
];

// The four photos framing the hero headline: left top, left bottom, right top, right bottom.
// Phones and tablets show left top, right top and right bottom in a row.
export const HERO_PHOTOS = [HERO_SLIDES[0], HERO_SLIDES[1], HERO_SLIDES[2], HERO_SLIDES[3]];

// Optional photo behind the whole hero, under a paper-coloured veil (HeroShowcase.jsx). null = the faint grid instead.
// e.g. { src: 'https://images.unsplash.com/photo-1631945788919-24e76faead25?auto=format&fit=crop&w=2000&q=70' } (cotton cord spools)
export const HERO_BACKGROUND = null;
