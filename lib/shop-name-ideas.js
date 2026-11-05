import { validateStoreName } from '@/lib/validation';

// Shop name ideas for the shop-opening wizard: the seller's own word(s) with common shop beginnings and endings.
// Plain string building, no outside service. The route then drops names other shops already use.

const ENDINGS = ['Studio', 'Designs', 'Shop', 'Prints', 'Creative', 'Digital', 'Co', 'Lab', 'House', 'Market', 'Works', 'Collective'];

/** "ali  khan!" → "Ali Khan": allowed characters only, each word capitalised. */
function tidy(text) {
  return String(text ?? '')
    .replace(/[^\p{L}\p{N} .&'-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/** Up to `count` name ideas built from what the seller typed (valid shop names, none equal to the typed one). */
export function shopNameIdeas(typed, count = 12) {
  let base = tidy(typed);
  if (base.length < 2) return [];
  // "Ali Studio" typed: build on "Ali", so the ideas aren't "Ali Studio Studio".
  const ending = ENDINGS.find((e) => base.toLowerCase().endsWith(` ${e.toLowerCase()}`));
  if (ending) base = base.slice(0, -(ending.length + 1));
  base = base.replace(/^The( |$)/, ''); // and "The Ali" typed: no "The The Ali"
  if (base.length < 2) return [];

  // Mixed styles first (so the few shown aren't all "… Studio, … Designs"), then the other endings.
  const ideas = [
    `${base} Studio`,
    `The ${base}`,
    `${base} Designs`,
    `${base} & Co`,
    `${base} Prints`,
    `Little ${base}`,
    `The ${base} Shop`,
    `Hello ${base}`,
    ...ENDINGS.map((e) => `${base} ${e}`),
  ];
  const typedKey = tidy(typed).toLowerCase();
  const seen = new Set();
  return ideas
    .filter((name) => {
      const key = name.toLowerCase();
      if (key === typedKey || seen.has(key) || validateStoreName(name)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, count);
}
