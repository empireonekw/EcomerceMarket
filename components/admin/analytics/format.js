// Formatting and chart colours for the admin analytics dashboard. Shared by server and client components.

import { formatPrice } from '@/lib/utils';

/**
 * Categorical slots, in this fixed order (validated with the dataviz palette checker on white: lightness band, chroma,
 * adjacent colour-blind separation and normal-vision floor all pass). Honey leads (the brand), then cool partners so
 * neighbours stay apart for colour-blind readers. Peach and aqua sit just under 3:1 on white, so every chart that uses
 * them also prints its values (legend or table).
 */
export const SERIES = ['#c98500', '#2a78d6', '#df7c52', '#6250d6', '#1baf7a'];
export const PREVIOUS = '#b5b0a8'; // the comparison period: a quiet grey, never a series colour
export const GRID = '#ecebe7';

const number = new Intl.NumberFormat('en-US');
const compactNumber = new Intl.NumberFormat('en-US', {
  notation: 'compact',
  maximumFractionDigits: 1,
});

export const formatCount = (n) => number.format(Math.round(n ?? 0));
export const formatCompact = (n) => (Math.abs(n) < 10_000 ? number.format(Math.round(n)) : compactNumber.format(n));
export const formatMoney = (cents) => formatPrice(Math.round(cents ?? 0), 'USD');
/** Axis money: "$0", "$40", "$1.2K". */
export const formatMoneyCompact = (cents) => {
  const dollars = (cents ?? 0) / 100;
  if (Math.abs(dollars) >= 10_000) return `$${compactNumber.format(dollars)}`;
  return dollars % 1 === 0 || Math.abs(dollars) >= 100 ? `$${number.format(Math.round(dollars))}` : `$${dollars.toFixed(2)}`;
};
export const formatPercent = (ratio, digits = 1) => `${((ratio ?? 0) * 100).toFixed(ratio > 0 && ratio < 0.1 ? digits : 0)}%`;

export function formatValue(value, kind) {
  if (value === null) return 'n/a'; // not enough data to give a figure (e.g. conversion before visitor tracking)
  if (kind === 'money') return formatMoney(value);
  if (kind === 'percent') return formatPercent(value);
  return formatCount(value);
}
export function formatAxis(value, kind) {
  if (kind === 'money') return formatMoneyCompact(value);
  if (kind === 'percent') return formatPercent(value, 0);
  return formatCompact(value);
}

/** Change against the previous period: { ratio, direction } or null when there's nothing to compare with. */
export function change(value, previous) {
  if (value === null || previous === null) return null;
  if (!previous) return value ? { ratio: null, direction: 'up' } : null; // from zero: "New", no percentage
  const ratio = (value - previous) / previous;
  return {
    ratio,
    direction: ratio > 0.0005 ? 'up' : ratio < -0.0005 ? 'down' : 'flat',
  };
}

/** Clean axis ticks from 0 to just above `max`: [0, 25, 50, 75, 100]. */
export function niceTicks(max, count = 4) {
  if (!(max > 0)) return [0, 1];
  const raw = max / count;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= raw) ?? 10 * magnitude;
  const ticks = [];
  for (let v = 0; v <= max + step * 0.001; v += step) ticks.push(v);
  if (ticks[ticks.length - 1] < max) ticks.push(ticks[ticks.length - 1] + step);
  return ticks;
}
