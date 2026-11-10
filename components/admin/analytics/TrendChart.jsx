'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { DeltaPill } from './KpiCard';
import { formatAxis, formatValue, GRID, niceTicks, PREVIOUS, SERIES } from './format';

const HEIGHT = 250;
const PAD = { top: 16, right: 16, bottom: 30, left: 48 };

/** Smooth path through the points that never overshoots between them (monotone cubic), so counts never dip below 0. */
function smoothPath(points) {
  const n = points.length;
  if (n === 0) return '';
  if (n === 1) return `M${points[0][0]},${points[0][1]}`;
  const dx = [];
  const slope = [];
  for (let i = 0; i < n - 1; i++) {
    dx.push(points[i + 1][0] - points[i][0]);
    slope.push((points[i + 1][1] - points[i][1]) / (dx[i] || 1));
  }
  const t = [slope[0]];
  for (let i = 1; i < n - 1; i++) t.push(slope[i - 1] * slope[i] <= 0 ? 0 : (slope[i - 1] + slope[i]) / 2);
  t.push(slope[n - 2]);
  for (let i = 0; i < n - 1; i++) {
    if (slope[i] === 0) {
      t[i] = 0;
      t[i + 1] = 0;
      continue;
    }
    const a = t[i] / slope[i];
    const b = t[i + 1] / slope[i];
    const h = a * a + b * b;
    if (h > 9) {
      const s = 3 / Math.sqrt(h);
      t[i] = s * a * slope[i];
      t[i + 1] = s * b * slope[i];
    }
  }
  let d = `M${points[0][0].toFixed(1)},${points[0][1].toFixed(1)}`;
  for (let i = 0; i < n - 1; i++) {
    const [x0, y0] = points[i];
    const [x1, y1] = points[i + 1];
    const h = dx[i] / 3;
    d += ` C${(x0 + h).toFixed(1)},${(y0 + t[i] * h).toFixed(1)} ${(x1 - h).toFixed(1)},${(y1 - t[i + 1] * h).toFixed(1)} ${x1.toFixed(1)},${y1.toFixed(1)}`;
  }
  return d;
}

/**
 * The dashboard's main chart (Skymetrics style): one metric at a time (picked in the header), this period against the
 * previous one as two smooth lines with point markers. One y-axis only. Hover or the arrow keys move a crosshair that
 * snaps to the nearest day; the tooltip shows both periods. "View as table" lists every value.
 * metrics: [{ key, label, kind: 'money'|'count'|'percent', current: number[], previous: number[] }]
 */
export default function TrendChart({ metrics, labels, prevLabels, compareLabel }) {
  const [active, setActive] = useState(metrics[0]?.key);
  const metric = metrics.find((m) => m.key === active) ?? metrics[0];
  const wrap = useRef(null);
  const [width, setWidth] = useState(640);
  const [hover, setHover] = useState(null);
  const [showTable, setShowTable] = useState(false);
  const selectId = useId();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  useEffect(() => {
    if (!menuOpen) return undefined;
    const close = (e) => !menuRef.current?.contains(e.target) && setMenuOpen(false);
    const esc = (e) => e.key === 'Escape' && setMenuOpen(false);
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', esc);
    return () => (document.removeEventListener('pointerdown', close), document.removeEventListener('keydown', esc));
  }, [menuOpen]);
  const tableId = useId();

  useEffect(() => {
    const el = wrap.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(260, Math.round(entry.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const n = labels.length;
  const ticks = useMemo(() => niceTicks(Math.max(...metric.current, ...metric.previous, 0), 5), [metric]);
  const top = ticks[ticks.length - 1] || 1;
  const innerW = width - PAD.left - PAD.right;
  const innerH = HEIGHT - PAD.top - PAD.bottom;
  const x = (i) => PAD.left + (n === 1 ? innerW / 2 : (i / (n - 1)) * innerW);
  const y = (v) => PAD.top + innerH - ((v ?? 0) / top) * innerH;
  const pts = (arr) => arr.map((v, i) => [x(i), y(v)]);
  const curPath = smoothPath(pts(metric.current));
  const prevPath = smoothPath(pts(metric.previous));
  const showDots = n <= 31;
  // Point markers on every few points (about seven), like the reference: enough to read the rhythm, never a crowd.
  const dotEvery = Math.max(1, Math.round(n / 7));

  const every = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(innerW / 84))));
  const xLabels = labels.map((_, i) => ((i % every === 0 && n - 1 - i >= every / 2) || i === n - 1 ? i : null)).filter((i) => i !== null);

  const total = (arr) => (metric.kind === 'percent' ? arr.reduce((a, b) => a + b, 0) / (arr.length || 1) : arr.reduce((a, b) => a + b, 0));
  const nowTotal = total(metric.current);
  const prevTotal = total(metric.previous);

  function pick(clientX) {
    const rect = wrap.current.getBoundingClientRect();
    const i = n === 1 ? 0 : Math.round(((clientX - rect.left - PAD.left) / innerW) * (n - 1));
    setHover(Math.min(n - 1, Math.max(0, i)));
  }
  function onKey(e) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End', 'Escape'].includes(e.key)) return;
    e.preventDefault();
    if (e.key === 'Escape') return setHover(null);
    const cur = hover ?? n - 1;
    setHover(e.key === 'Home' ? 0 : e.key === 'End' ? n - 1 : Math.min(n - 1, Math.max(0, cur + (e.key === 'ArrowRight' ? 1 : -1))));
  }
  const tipLeft = hover === null ? 0 : Math.min(Math.max(x(hover) - 84, 0), width - 168);
  const tipTop = hover === null ? 0 : Math.max(0, Math.min(y(metric.current[hover]), y(metric.previous[hover])) - 78);

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5">
        <div>
          {/* A styled menu, not a native <select>: the browser's own list looked out of place on the dashboard. */}
          <div className="relative" ref={menuRef}>
            <button
              id={selectId}
              type="button"
              aria-haspopup="listbox"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((v) => !v)}
              className="-ml-2 inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-base font-semibold text-ink hover:bg-stone-50 focus-visible:ring-2 focus-visible:ring-ink focus-visible:outline-none"
            >
              {metric.label} over time
              <ChevronDown
                size={16}
                strokeWidth={2}
                aria-hidden="true"
                className={`text-stone-400 transition-transform ${menuOpen ? 'rotate-180' : ''}`}
              />
            </button>
            {menuOpen && (
              <ul
                role="listbox"
                aria-labelledby={selectId}
                className="absolute left-0 z-30 mt-1.5 w-60 rounded-2xl border border-stone-200 bg-white p-1.5 shadow-[0_24px_50px_-20px_rgba(16,16,16,0.25)]"
              >
                {metrics.map((m) => (
                  <li key={m.key} role="option" aria-selected={m.key === metric.key}>
                    <button
                      type="button"
                      onClick={() => (setActive(m.key), setHover(null), setMenuOpen(false))}
                      className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm hover:bg-stone-50"
                    >
                      <span className={m.key === metric.key ? 'font-semibold text-ink' : 'text-stone-700'}>{m.label}</span>
                      {m.key === metric.key && <Check size={15} strokeWidth={2.5} aria-hidden="true" />}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-stone-500">
            <span className="font-semibold text-ink">{formatValue(nowTotal, metric.kind)}</span>
            {metric.kind === 'percent' ? 'average' : 'in total'}
            <DeltaPill value={nowTotal} previous={prevTotal} />
          </p>
        </div>
        <ul className="flex items-center gap-4 pt-1 text-xs text-stone-600" aria-label="Legend">
          <li className="flex items-center gap-1.5">
            <span aria-hidden="true" className="size-2 rounded-full" style={{ background: SERIES[0] }} />
            Current period
          </li>
          <li className="flex items-center gap-1.5">
            <span aria-hidden="true" className="size-2 rounded-full" style={{ background: PREVIOUS }} />
            Previous period
          </li>
        </ul>
      </div>

      <div
        ref={wrap}
        className="relative mt-3 flex-1 px-1 outline-none focus-visible:rounded-xl focus-visible:ring-2 focus-visible:ring-ink"
        tabIndex={0}
        role="img"
        aria-label={`${metric.label}, current period against the previous one. Use the arrow keys to read each value.`}
        onPointerMove={(e) => pick(e.clientX)}
        onPointerLeave={() => setHover(null)}
        onKeyDown={onKey}
        onBlur={() => setHover(null)}
      >
        <svg width={width} height={HEIGHT} className="block max-w-full" aria-hidden="true">
          {ticks.map((tk) => (
            <g key={tk}>
              <line x1={PAD.left} x2={width - PAD.right} y1={y(tk)} y2={y(tk)} stroke={GRID} strokeWidth="1" />
              <text x={PAD.left - 12} y={y(tk)} dy="0.32em" textAnchor="end" className="fill-stone-400 text-[11px] tabular-nums">
                {formatAxis(tk, metric.kind)}
              </text>
            </g>
          ))}
          {xLabels.map((i) => (
            <text
              key={i}
              x={x(i)}
              y={HEIGHT - 8}
              textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}
              className="fill-stone-400 text-[11px]"
            >
              {labels[i]}
            </text>
          ))}
          <path d={prevPath} fill="none" stroke={PREVIOUS} strokeWidth="2" strokeLinecap="round" />
          <path d={curPath} fill="none" stroke={SERIES[0]} strokeWidth="2.25" strokeLinecap="round" />
          {showDots &&
            metric.previous.map((v, i) =>
              i % dotEvery === 0 && i !== hover ? (
                <circle key={`p${i}`} cx={x(i)} cy={y(v)} r="3.5" fill={PREVIOUS} stroke="#fff" strokeWidth="2" />
              ) : null,
            )}
          {showDots &&
            metric.current.map((v, i) =>
              i % dotEvery === 0 && i !== hover ? (
                <circle key={`c${i}`} cx={x(i)} cy={y(v)} r="4" fill={SERIES[0]} stroke="#fff" strokeWidth="2" />
              ) : null,
            )}
          {hover !== null && (
            <g>
              <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={PAD.top + innerH} stroke="#d6d3cd" strokeWidth="1" />
              <circle cx={x(hover)} cy={y(metric.previous[hover])} r="4.5" fill={PREVIOUS} stroke="#fff" strokeWidth="2" />
              <circle cx={x(hover)} cy={y(metric.current[hover])} r="5" fill={SERIES[0]} stroke="#fff" strokeWidth="2" />
            </g>
          )}
        </svg>

        {hover !== null && (
          <div
            className="pointer-events-none absolute z-10 w-[168px] rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-xs shadow-[0_12px_30px_-12px_rgba(16,16,16,0.25)]"
            style={{ left: tipLeft, top: tipTop }}
            aria-live="polite"
          >
            <p className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-1.5 text-stone-500">
                <span aria-hidden="true" className="size-1.5 rounded-full" style={{ background: SERIES[0] }} />
                {labels[hover]}
              </span>
              <span className="font-semibold text-ink">{formatValue(metric.current[hover], metric.kind)}</span>
            </p>
            <p className="mt-1 flex items-center justify-between gap-3">
              <span className="flex items-center gap-1.5 text-stone-500">
                <span aria-hidden="true" className="size-1.5 rounded-full" style={{ background: PREVIOUS }} />
                {prevLabels[hover]}
              </span>
              <span className="font-semibold text-stone-600">{formatValue(metric.previous[hover], metric.kind)}</span>
            </p>
          </div>
        )}
      </div>

      <div className="flex justify-end px-5 pb-4">
        <button
          type="button"
          aria-expanded={showTable}
          aria-controls={tableId}
          onClick={() => setShowTable((v) => !v)}
          className="text-xs font-medium text-stone-400 hover:text-ink"
        >
          {showTable ? 'Hide table' : 'View as table'}
        </button>
      </div>
      {showTable && (
        <table id={tableId} className="mx-5 mb-5 text-left text-sm">
          <caption className="sr-only">
            {metric.label}, current period and the {compareLabel}
          </caption>
          <thead className="text-xs text-stone-500">
            <tr>
              <th className="py-1.5 pr-6 font-medium">Date</th>
              <th className="py-1.5 pr-6 text-right font-medium">Current</th>
              <th className="py-1.5 pr-6 font-medium">Compared with</th>
              <th className="py-1.5 text-right font-medium">Previous</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100 tabular-nums">
            {labels.map((l, i) => (
              <tr key={l + i}>
                <td className="py-1.5 pr-6">{l}</td>
                <td className="py-1.5 pr-6 text-right">{formatValue(metric.current[i], metric.kind)}</td>
                <td className="py-1.5 pr-6 text-stone-500">{prevLabels[i]}</td>
                <td className="py-1.5 text-right text-stone-500">{formatValue(metric.previous[i], metric.kind)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
