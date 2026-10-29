'use client';

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Bot,
  ChevronDown,
  Clock,
  Cloud,
  Cpu,
  CreditCard,
  Database,
  FileImage,
  Gauge,
  HardDrive,
  HeartPulse,
  KeyRound,
  LayoutDashboard,
  Mail,
  Maximize,
  MessageSquare,
  Minimize,
  Package,
  Radio,
  Scan,
  ShieldAlert,
  ShieldCheck,
  ShoppingCart,
  Store,
  UserCog,
  Users,
  X,
  XCircle,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { MONITOR_EDGES } from '@/lib/monitor-map';

const POLL_MS = 5000;

const LEVEL = {
  error: { label: 'Error', stroke: '#dc2626', fill: '#fef2f2', text: 'text-red-700', chip: 'bg-red-50 text-red-700 ring-red-600/20' },
  warning: { label: 'Warning', stroke: '#d97706', fill: '#fffbeb', text: 'text-amber-700', chip: 'bg-amber-50 text-amber-700 ring-amber-600/20' },
  ok: { label: 'Healthy', stroke: '#059669', fill: '#ecfdf5', text: 'text-emerald-700', chip: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20' },
  idle: { label: 'Idle', stroke: '#a8a29e', fill: '#f5f5f4', text: 'text-stone-600', chip: 'bg-stone-100 text-stone-600 ring-stone-500/20' },
};

const ICONS = {
  visitors: Users,
  edge: Cloud,
  proxy: ShieldCheck,
  pages: LayoutDashboard,
  auth: KeyRound,
  catalog: Package,
  checkout: ShoppingCart,
  messages: MessageSquare,
  seller: Store,
  admin: UserCog,
  contact: Mail,
  files: FileImage,
  health: HeartPulse,
  mongodb: Database,
  socket: Radio,
  storage: HardDrive,
  recaptcha: Bot,
  payments: CreditCard,
};

// Diagram geometry (px). Five columns of cards, left → right. Lines run like a circuit board: straight out of a card
// to a shared vertical rail halfway to the next column, along the rail, then straight into the target. Lines that
// share a rail merge into one, so nothing crosses; hovering a card shows its own lines. Below MIN_CANVAS the view
// zooms out to fit.
const COL_TITLES = ['Visitors', 'Edge', 'Gateway', 'Pages & APIs', 'Services'];
const BASE_W = [150, 180, 150, 190, 200]; // column widths at the smallest size; they grow up to 20% on wide screens
const NODE_H = 56;
const ROW = 76; // vertical step between cards in the longest column
const PAD_X = 24;
const TOP = 56; // room for the column titles and the line over the top
const MIN_GAP = 60;
const MIN_CANVAS = BASE_W.reduce((a, b) => a + b, 0) + 4 * MIN_GAP + 2 * PAD_X;
// Services top → bottom: Socket.IO on top (the Cloudflare → Socket.IO line arrives over the other columns), the
// database in the middle where most lines go.
const SERVICE_ORDER = ['socket', 'recaptcha', 'mongodb', 'payments', 'storage'];

function layout(nodes, width) {
  const canvas = Math.max(width, MIN_CANVAS);
  const base = BASE_W.reduce((a, b) => a + b, 0);
  const grow = Math.min(1.2, (canvas - 2 * PAD_X - 4 * MIN_GAP) / base);
  const widths = BASE_W.map((w) => Math.round(w * grow));
  const gap = (canvas - 2 * PAD_X - widths.reduce((a, b) => a + b, 0)) / 4;
  const colX = [];
  widths.reduce((x, w) => (colX.push(x), x + w + gap), PAD_X);

  const byCol = colX.map((_, c) => nodes.filter((n) => n.col === c));
  byCol[4].sort((a, b) => SERVICE_ORDER.indexOf(a.id) - SERVICE_ORDER.indexOf(b.id));
  const span = (Math.max(...byCol.map((list) => list.length)) - 1) * ROW;
  const pos = {};
  byCol.forEach((list, c) => {
    // Short columns spread over the long one's height, centred.
    list.forEach((n, i) => {
      const y = list.length === 1 ? TOP + span / 2 : TOP + (span * i) / (list.length - 1);
      pos[n.id] = { x: colX[c], y, w: widths[c], h: NODE_H, col: c };
    });
  });
  // Each column's lines leave on a rail halfway across the gap to the next column.
  const rails = colX.map((x, c) => x + widths[c] + gap / 2);
  return { pos, colX, widths, rails, canvas, height: TOP + span + NODE_H + 28 };
}

const CORNER = 10;
/**
 * Out of a card, along the rail at x = rail, into the target — with rounded corners. `d` is the whole route (dots
 * follow it); `start` / `rail` / `end` are its three parts, drawn separately so the shared rail stays neutral and only
 * each card's own connector takes a status colour.
 */
function railPath(x1, y1, x2, y2, rail) {
  if (Math.abs(y2 - y1) < 1) {
    const d = `M ${x1} ${y1} L ${x2} ${y2}`;
    return { d, end: d };
  }
  const dir = y2 > y1 ? 1 : -1;
  const r = Math.min(CORNER, Math.abs(y2 - y1) / 2);
  const start = `M ${x1} ${y1} L ${rail - r} ${y1}`;
  const middle = `Q ${rail} ${y1} ${rail} ${y1 + dir * r} L ${rail} ${y2 - dir * r} Q ${rail} ${y2} ${rail + r} ${y2}`;
  return {
    d: `${start} ${middle} L ${x2} ${y2}`,
    start,
    rail: `M ${rail - r} ${y1} ${middle}`,
    end: `M ${rail + r} ${y2} L ${x2} ${y2}`,
  };
}
/** Cloudflare → Socket.IO: up from the card, along the top over the other columns, down into Socket.IO. */
function overTheTop(from, to) {
  const lane = TOP - 18;
  const sx = from.x + from.w / 2;
  const tx = to.x + to.w / 2;
  return `M ${sx} ${from.y} L ${sx} ${lane + CORNER} Q ${sx} ${lane} ${sx + CORNER} ${lane} L ${tx - CORNER} ${lane} Q ${tx} ${lane} ${tx} ${lane + CORNER} L ${tx} ${to.y}`;
}

const rpmOf = (n) => n?.stats?.lastMinute?.requests ?? 0;
const recentOf = (n) => n?.stats?.last5?.requests ?? 0;
const LEVEL_ORDER = { idle: 0, ok: 1, warning: 2, error: 3 };

/** Requests per minute travelling along a line (0 = none), and how many in the last 5 min. */
function lineTraffic(from, to, totals) {
  if (to.kind === 'route') return { rate: rpmOf(to), recent: recentOf(to) };
  if (from.kind === 'route') return { rate: rpmOf(from), recent: recentOf(from) };
  if (to.id === 'socket') {
    const live = to.metrics?.connections ?? 0;
    return { rate: live, recent: live };
  }
  return { rate: totals.rpm, recent: totals.m5 ?? totals.rpm };
}

/** Dots on a line: none without traffic in the last 5 min; more and faster with more requests per minute. */
const dotsFor = (rate, recent) => ({
  dots: rate >= 60 ? 3 : rate >= 10 ? 2 : rate > 0 || recent > 0 ? 1 : 0,
  dur: rate >= 60 ? 1.6 : rate >= 10 ? 2.2 : rate > 0 ? 2.8 : 3.6,
});

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  return reduced;
}

const fmtUptime = (s) => (s < 3600 ? `${Math.floor(s / 60)} min` : s < 86400 ? `${Math.floor(s / 3600)} h ${Math.floor((s % 3600) / 60)} min` : `${Math.floor(s / 86400)} d ${Math.floor((s % 86400) / 3600)} h`);
const ago = (iso, now) => {
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  return s < 60 ? `${s}s ago` : `${Math.floor(s / 60)} min ago`;
};
const clock = (t) => new Date(t).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit' });

function LevelChip({ level }) {
  const l = LEVEL[level] ?? LEVEL.idle;
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${l.chip}`}>{l.label}</span>;
}

function Summary({ snap }) {
  const { totals, process: proc } = snap;
  const cards = [
    { label: 'Overall', value: LEVEL[snap.overall]?.label ?? '–', icon: Activity, tone: snap.overall },
    { label: 'Requests / min', value: totals.rpm, icon: Gauge, tone: 'idle' },
    { label: 'Server errors (5 min)', value: totals.serverErrors, icon: XCircle, tone: totals.serverErrors ? 'error' : 'ok' },
    { label: 'Rate-limited (5 min)', value: totals.rateLimited, icon: ShieldAlert, tone: totals.rateLimited ? 'warning' : 'ok' },
    { label: 'Slowest p95', value: totals.p95 != null ? `${totals.p95} ms` : '–', icon: Clock, tone: totals.p95 > 1500 ? 'warning' : 'idle' },
    {
      label: 'Server',
      value: `${proc.rssMb} MB`,
      sub: `up ${fmtUptime(proc.uptimeSec)}${proc.eventLoopMs ? ` · loop ${proc.eventLoopMs.p99} ms` : ''}`,
      icon: Cpu,
      tone: proc.issues.length ? 'warning' : 'idle',
    },
  ];
  return (
    <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
      {cards.map(({ label, value, sub, icon: Icon, tone }) => (
        <div key={label} className="rounded-2xl border border-stone-200 bg-white p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-stone-500">{label}</p>
            <Icon size={16} strokeWidth={1.75} aria-hidden="true" className={LEVEL[tone]?.text ?? 'text-stone-500'} />
          </div>
          <p className={`mt-2 text-2xl font-medium tabular-nums ${tone === 'error' || tone === 'warning' ? LEVEL[tone].text : 'text-ink'}`}>{value}</p>
          {sub && <p className="mt-0.5 truncate text-xs text-stone-500">{sub}</p>}
        </div>
      ))}
    </div>
  );
}

const MIN_ZOOM = 0.3;
const MAX_ZOOM = 2.5;
const clampZoom = (k) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, k));

function ToolButton({ label, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="grid size-8 place-items-center text-stone-600 transition hover:bg-stone-100 hover:text-ink focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-700"
    >
      {children}
    </button>
  );
}

function StatusDot({ level }) {
  const l = LEVEL[level] ?? LEVEL.idle;
  return (
    <span className="relative flex size-2 shrink-0" aria-hidden="true">
      {level === 'error' && <span className="absolute inline-flex size-full rounded-full opacity-60 motion-safe:animate-ping" style={{ background: l.stroke }} />}
      <span className="relative inline-flex size-full rounded-full" style={{ background: l.stroke }} />
    </span>
  );
}

/**
 * The flow canvas, left → right: Visitors → Cloudflare + nginx → proxy.js → pages & API areas → services. Cards and
 * lines take the colour of their status; dots travel along a line while requests flow through it (more and faster
 * dots for more traffic). Hover or select a card to see only its own connections. Drag to move; zoom with the
 * buttons, Ctrl/⌘ + scroll, a trackpad or two-finger pinch, or + / − / 0; fullscreen from the toolbar. `children`
 * (the details panel) sit over the canvas.
 */
function Diagram({ nodes, totals, selected, onSelect, children }) {
  const uid = useId().replace(/:/g, '');
  const boxRef = useRef(null);
  const viewportRef = useRef(null);
  const [boxWidth, setBoxWidth] = useState(null);
  const [full, setFull] = useState(false);
  const [view, setView] = useState(null); // { x, y, k }: canvas offset (px) and zoom
  const [hovered, setHovered] = useState(null);
  const [dragging, setDragging] = useState(false);
  const pointers = useRef(new Map());
  const gesture = useRef({ moved: false, start: null });
  const fullRef = useRef(false);
  const reduced = useReducedMotion();

  useLayoutEffect(() => {
    const el = boxRef.current;
    const ro = new ResizeObserver(() => setBoxWidth(el.clientWidth));
    ro.observe(el);
    setBoxWidth(el.clientWidth);
    const onFull = () => {
      fullRef.current = document.fullscreenElement === el;
      setFull(fullRef.current);
    };
    document.addEventListener('fullscreenchange', onFull);
    return () => {
      ro.disconnect();
      document.removeEventListener('fullscreenchange', onFull);
    };
  }, []);

  // The layout fills the box's width (never narrower than MIN_CANVAS); "fit" shrinks it to show everything.
  const { pos, colX, widths, rails, canvas, height } = useMemo(() => layout(nodes, Math.max(boxWidth ?? MIN_CANVAS, MIN_CANVAS)), [nodes, boxWidth]);
  const fitK = boxWidth ? Math.min(1, boxWidth / canvas) : 1;
  const viewportH = full ? (typeof window === 'undefined' ? height : window.innerHeight) : Math.max(320, Math.round(height * fitK));

  const fit = useCallback(() => {
    if (!boxWidth) return;
    const k = full ? Math.min(1.4, boxWidth / canvas, viewportH / height) : fitK;
    setView({ k, x: (boxWidth - canvas * k) / 2, y: (viewportH - height * k) / 2 });
  }, [boxWidth, canvas, height, fitK, full, viewportH]);

  // Re-fit when the box changes size or enters/leaves fullscreen; polling never moves the view.
  useEffect(fit, [fit]);

  const zoomAt = useCallback((px, py, factor) => {
    setView((v) => {
      if (!v) return v;
      const k = clampZoom(v.k * factor);
      const r = k / v.k;
      return { k, x: px - (px - v.x) * r, y: py - (py - v.y) * r };
    });
  }, []);
  const zoomCenter = (factor) => {
    const el = viewportRef.current;
    zoomAt(el.clientWidth / 2, el.clientHeight / 2, factor);
  };

  // Ctrl/⌘ + scroll and trackpad pinch zoom (plain scroll keeps scrolling the page, except in fullscreen).
  useEffect(() => {
    const el = viewportRef.current;
    const onWheel = (e) => {
      if (!(e.ctrlKey || e.metaKey || fullRef.current)) return;
      e.preventDefault();
      const r = el.getBoundingClientRect();
      // Trackpad pinches send many small deltas, a mouse wheel ~100 per notch: both end up a comfortable step.
      zoomAt(e.clientX - r.left, e.clientY - r.top, Math.exp(-e.deltaY * (Math.abs(e.deltaY) < 50 ? 0.01 : 0.002)));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [zoomAt]);

  const onPointerDown = (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 1) gesture.current = { moved: false, start: { x: e.clientX, y: e.clientY } };
  };
  const onPointerMove = (e) => {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    const cur = { x: e.clientX, y: e.clientY };
    const g = gesture.current;
    if (pointers.current.size === 2) {
      // Two fingers: zoom by how much they spread, around the point between them.
      const [other] = [...pointers.current.entries()].filter(([id]) => id !== e.pointerId).map(([, p]) => p);
      const before = Math.hypot(prev.x - other.x, prev.y - other.y);
      const after = Math.hypot(cur.x - other.x, cur.y - other.y);
      const r = viewportRef.current.getBoundingClientRect();
      if (before > 0) zoomAt((cur.x + other.x) / 2 - r.left, (cur.y + other.y) / 2 - r.top, after / before);
      g.moved = true;
    } else {
      if (!g.moved && Math.hypot(cur.x - g.start.x, cur.y - g.start.y) > 4) {
        g.moved = true;
        setDragging(true);
        viewportRef.current.setPointerCapture(e.pointerId); // only now, so a plain click still reaches the card
      }
      if (g.moved) setView((v) => v && { ...v, x: v.x + cur.x - prev.x, y: v.y + cur.y - prev.y });
    }
    pointers.current.set(e.pointerId, cur);
  };
  const onPointerUp = (e) => {
    pointers.current.delete(e.pointerId);
    if (!pointers.current.size) setDragging(false);
  };

  const toggleFull = () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else boxRef.current.requestFullscreen?.();
  };
  const onKeyDown = (e) => {
    if (e.target.closest('aside')) return;
    if (e.key === '+' || e.key === '=') zoomCenter(1.25);
    else if (e.key === '-' || e.key === '_') zoomCenter(0.8);
    else if (e.key === '0') fit();
    else return;
    e.preventDefault();
  };

  // ---- Lines. A focused (hovered / selected) card keeps its own lines and fades the rest.
  const byId = useMemo(() => Object.fromEntries(nodes.map((n) => [n.id, n])), [nodes]);
  const focus = hovered ?? selected;
  const neighbours = new Set(focus ? MONITOR_EDGES.flatMap(([f, t]) => (f === focus ? [t] : t === focus ? [f] : [])) : []);
  const dim = (id) => Boolean(focus) && id !== focus && !neighbours.has(id);
  const hasIn = new Set(MONITOR_EDGES.map(([, t]) => t));
  const hasOut = new Set(MONITOR_EDGES.map(([f]) => f));
  const mid = (p) => p.y + p.h / 2;

  const lines = MONITOR_EDGES.map(([from, to]) => {
    const a = pos[from];
    const b = pos[to];
    if (!a || !b) return null;
    const src = byId[from];
    const dst = byId[to];
    const { rate, recent } = lineTraffic(src, dst, totals);
    // A line takes the worse of its two ends, so a failing service shows on every line into it.
    const level = [src.level, dst.level].includes('error') ? 'error' : src.level === 'idle' || dst.level === 'idle' ? 'idle' : dst.level;
    const shape = b.col - a.col > 1 ? { d: overTheTop(a, b), end: overTheTop(a, b) } : railPath(a.x + a.w, mid(a), b.x, mid(b), rails[a.col]);
    // The connector out of a card shows that card's state: an area's own line its line state, the one shared by all
    // of proxy.js's lines proxy's state.
    const startLevel = src.kind === 'route' ? level : src.level;
    const on = !focus || from === focus || to === focus;
    return { id: `${uid}-${from}-${to}`, ...shape, level, startLevel, faded: !on, top: Boolean(focus) && on, ...dotsFor(rate, recent) };
  })
    .filter(Boolean)
    // Worse states on top where lines share a rail; the focused card's lines above everything.
    .sort((a, b) => (a.top - b.top) * 10 + LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level]);

  const k = view?.k ?? fitK;

  const card = (n) => {
    const p = pos[n.id];
    const l = LEVEL[n.level] ?? LEVEL.idle;
    const Icon = ICONS[n.id] ?? Activity;
    const isSelected = selected === n.id;
    return (
      <button
        key={n.id}
        type="button"
        aria-pressed={isSelected}
        aria-label={`${n.label}: ${l.label}. ${n.detail ?? ''}`}
        onClick={(e) => (e.detail === 0 || !gesture.current.moved) && onSelect(isSelected ? null : n.id)}
        onMouseEnter={() => setHovered(n.id)}
        onMouseLeave={() => setHovered(null)}
        onFocus={() => setHovered(n.id)}
        onBlur={() => setHovered(null)}
        title={`${n.label}: ${n.detail || n.sub}`}
        className={`absolute flex items-center gap-2 rounded-xl border bg-white px-2 text-left shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition duration-200 hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700 ${
          isSelected ? 'border-ink ring-2 ring-ink/10' : 'border-stone-200'
        } ${dim(n.id) ? 'opacity-35' : 'opacity-100'} ${dragging ? 'cursor-grabbing' : 'cursor-pointer'}`}
        style={{ left: p.x, top: p.y, width: p.w, height: p.h }}
      >
        {hasIn.has(n.id) && <span className="absolute top-1/2 -left-[5px] size-2.5 -translate-y-1/2 rounded-full border-2 border-white" style={{ background: l.stroke }} aria-hidden="true" />}
        {hasOut.has(n.id) && <span className="absolute top-1/2 -right-[5px] size-2.5 -translate-y-1/2 rounded-full border-2 border-white" style={{ background: l.stroke }} aria-hidden="true" />}
        <span className="grid size-8 shrink-0 place-items-center rounded-lg" style={{ background: l.fill, color: l.stroke }}>
          <Icon size={17} strokeWidth={1.9} aria-hidden="true" />
        </span>
        <span className="absolute top-2 right-2">
          <StatusDot level={n.level} />
        </span>
        <span className="min-w-0 flex-1 pr-1">
          <span className="block truncate text-[13px] leading-tight font-semibold text-ink">{n.label}</span>
          <span className="mt-0.5 block truncate text-[11px] leading-tight text-stone-500">{n.detail || n.sub}</span>
        </span>
      </button>
    );
  };

  return (
    // inline-size containment: the wide canvas never widens the page around it.
    <div ref={boxRef} onKeyDown={onKeyDown} className={`relative bg-white [contain:inline-size] ${full ? 'flex h-dvh flex-col' : 'rounded-2xl border border-stone-200'}`}>
      <div
        ref={viewportRef}
        role="group"
        aria-label="Live system flow. Drag to move; Ctrl + scroll or the zoom buttons to zoom."
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className={`relative overflow-hidden bg-stone-50/70 select-none [touch-action:pan-y] ${full ? 'flex-1' : 'rounded-2xl'} ${dragging ? 'cursor-grabbing' : 'cursor-grab'}`}
        style={{
          height: full ? undefined : viewportH,
          backgroundImage: 'radial-gradient(circle, #d6d3d1 1px, transparent 1px)',
          backgroundSize: `${20 * k}px ${20 * k}px`,
          backgroundPosition: view ? `${view.x}px ${view.y}px` : undefined,
        }}
      >
        <div
          className={`absolute top-0 left-0 origin-top-left transition-opacity duration-300 ${view ? 'opacity-100' : 'opacity-0'}`}
          style={{ width: canvas, height, transform: view ? `translate(${view.x}px, ${view.y}px) scale(${view.k})` : undefined }}
        >
          {COL_TITLES.map((title, c) => (
            <p key={title} className="absolute top-3 text-center text-[11px] font-semibold tracking-wider text-stone-400 uppercase" style={{ left: colX[c], width: widths[c] }}>
              {title}
            </p>
          ))}

          <svg width={canvas} height={height} className="pointer-events-none absolute inset-0 overflow-visible" aria-hidden="true">
            {/* 1. Shared rails: neutral, unless they belong to the focused card. */}
            {lines
              .filter((line) => line.rail)
              .map((line) => (
                <path
                  key={`${line.id}-rail`}
                  d={line.rail}
                  fill="none"
                  stroke={line.top ? LEVEL[line.level].stroke : '#d6d3d1'}
                  strokeOpacity={line.top ? 0.6 : 1}
                  strokeWidth={line.top ? 2.5 : 2}
                  opacity={line.faded ? 0.25 : 1}
                  className="transition-opacity duration-200"
                />
              ))}
            {/* 2. Each card's own connectors, in their status colour. */}
            {lines.map((line) =>
              [
                ['start', line.start, line.startLevel],
                ['end', line.end, line.level],
              ]
                .filter(([, d]) => d)
                .map(([part, d, level]) => (
                  <path
                    key={`${line.id}-${part}`}
                    d={d}
                    fill="none"
                    stroke={LEVEL[level].stroke}
                    strokeOpacity={level === 'idle' ? 0.6 : 0.55}
                    strokeWidth={line.top ? 2.5 : 2}
                    strokeDasharray={level === 'idle' ? '4 5' : undefined}
                    strokeLinecap="round"
                    opacity={line.faded ? 0.1 : 1}
                    className="transition-opacity duration-200"
                  />
                )),
            )}
            {/* 3. Moving dots along each whole route. */}
            {lines.map((line) => {
              const l = LEVEL[line.level];
              return (
                <g key={line.id}>
                  <path id={line.id} d={line.d} fill="none" stroke="none" />
                  {!reduced &&
                    !line.faded &&
                    Array.from({ length: line.dots }, (_, i) => (
                      <g key={i}>
                        <circle r="6" fill={l.stroke} opacity="0.18">
                          <animateMotion dur={`${line.dur}s`} begin={`${(-i * line.dur) / line.dots}s`} repeatCount="indefinite">
                            <mpath href={`#${line.id}`} />
                          </animateMotion>
                        </circle>
                        <circle r="3" fill={l.stroke}>
                          <animateMotion dur={`${line.dur}s`} begin={`${(-i * line.dur) / line.dots}s`} repeatCount="indefinite">
                            <mpath href={`#${line.id}`} />
                          </animateMotion>
                        </circle>
                      </g>
                    ))}
                </g>
              );
            })}
          </svg>

          {nodes.map(card)}

        </div>

        {/* Toolbar: zoom, fit, fullscreen. Stops pointer events so pressing a button never starts a drag. */}
        <div className="absolute bottom-3 left-3 flex items-center gap-2" onPointerDown={(e) => e.stopPropagation()}>
          <div className="flex overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm [&>*+*]:border-l [&>*+*]:border-stone-200">
            <ToolButton label="Zoom out (−)" onClick={() => zoomCenter(0.8)}>
              <ZoomOut size={16} aria-hidden="true" />
            </ToolButton>
            <span className="grid min-w-12 place-items-center px-1 text-xs font-medium text-stone-600 tabular-nums" aria-live="polite">
              {Math.round(k * 100)}%
            </span>
            <ToolButton label="Zoom in (+)" onClick={() => zoomCenter(1.25)}>
              <ZoomIn size={16} aria-hidden="true" />
            </ToolButton>
            <ToolButton label="Fit to screen (0)" onClick={fit}>
              <Scan size={16} aria-hidden="true" />
            </ToolButton>
            <ToolButton label={full ? 'Exit fullscreen' : 'Fullscreen'} onClick={toggleFull}>
              {full ? <Minimize size={16} aria-hidden="true" /> : <Maximize size={16} aria-hidden="true" />}
            </ToolButton>
          </div>
          <p className="hidden rounded-lg bg-white/80 px-2 py-1 text-[11px] text-stone-500 backdrop-blur sm:block">Hover a box to see its connections · Drag to move · Ctrl + scroll to zoom</p>
        </div>
      </div>
      {children}
    </div>
  );
}

function Sparkline({ series }) {
  const max = Math.max(1, ...series);
  return (
    <svg viewBox={`0 0 ${series.length * 8} 32`} className="h-8 w-full" aria-label="Requests per minute, last 15 minutes">
      {series.map((v, i) => (
        <rect key={i} x={i * 8 + 1} y={32 - (v / max) * 30} width={6} height={Math.max(1, (v / max) * 30)} rx={1.5} fill={v ? '#edae49' : '#e7e5e4'} />
      ))}
    </svg>
  );
}

/** Details of the selected card: over the canvas on wide screens (on the side away from the card), below it on narrow ones. */
function Details({ node, now, onClose }) {
  const s = node.stats;
  const avg = s?.last5?.requests ? Math.round(s.last5.totalMs / s.last5.requests) : null;
  const rows = s
    ? [
        ['Requests (last min)', s.lastMinute.requests],
        ['Requests (5 min)', s.last5.requests],
        ['Server errors 5xx (5 min)', s.last5.serverErrors],
        ['Rate-limited 429 (5 min)', s.last5.rateLimited],
        ['Client errors 4xx (5 min)', s.last5.clientErrors],
        ['Average response', avg != null ? `${avg} ms` : '–'],
        ['95% under', s.p95 != null ? `${s.p95} ms` : '–'],
      ]
    : Object.entries(node.metrics ?? {}).map(([k, v]) => [k === 'pingMs' ? 'Ping' : k === 'connections' ? 'Live connections' : k, k === 'pingMs' ? `${v} ms` : v]);
  const Icon = ICONS[node.id] ?? Activity;
  const l = LEVEL[node.level] ?? LEVEL.idle;

  return (
    <aside
      aria-label={`${node.label} details`}
      className={`space-y-4 rounded-2xl border border-stone-200 bg-white p-5 shadow-xl lg:absolute lg:top-3 lg:max-h-[calc(100%-1.5rem)] lg:w-[22rem] lg:overflow-y-auto ${node.col >= 3 ? 'lg:left-3' : 'lg:right-3'}`}
    >
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl" style={{ background: l.fill, color: l.stroke }}>
          <Icon size={20} strokeWidth={1.9} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-base font-semibold">{node.label}</p>
          <p className="text-sm text-stone-500">{node.sub}</p>
        </div>
        <button type="button" onClick={onClose} className="-m-1 rounded-lg p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-700" aria-label="Close details">
          <X size={18} aria-hidden="true" />
        </button>
      </div>
      <div className="flex items-center gap-2">
        <LevelChip level={node.level} />
        {node.detail && <p className="text-sm text-stone-700">{node.detail}</p>}
      </div>

      {node.issues.length > 0 && (
        <ul className="space-y-2">
          {node.issues.map((i) => (
            <li key={i.text} className={`flex gap-2 rounded-xl px-3 py-2 text-sm ${i.level === 'error' ? 'bg-red-50 text-red-800' : 'bg-amber-50 text-amber-800'}`}>
              {i.level === 'error' ? <XCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" /> : <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />}
              {i.text}
            </li>
          ))}
        </ul>
      )}

      {rows.length > 0 && (
        <dl className="divide-y divide-stone-100 text-sm">
          {rows.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4 py-1.5">
              <dt className="text-stone-500">{k}</dt>
              <dd className="font-medium tabular-nums">{v}</dd>
            </div>
          ))}
        </dl>
      )}
      {s?.series && (
        <div>
          <p className="mb-1 text-xs text-stone-500">Requests per minute · last 15 min</p>
          <Sparkline series={s.series} />
        </div>
      )}
      {node.recentErrors.length > 0 && (
        <div>
          <p className="mb-1.5 text-xs font-semibold tracking-wide text-stone-500 uppercase">Recent errors</p>
          <ul className="space-y-1.5">
            {node.recentErrors.map((e) => (
              <li key={`${e.at}-${e.message}`} className="rounded-lg bg-stone-50 px-3 py-2 font-mono text-[11px] leading-relaxed text-stone-700">
                <span className="text-stone-400">{ago(new Date(e.at).toISOString(), now)} · </span>
                {e.message}
              </li>
            ))}
          </ul>
        </div>
      )}
    </aside>
  );
}

const LOG_PREVIEW = 5;

/** The server's recent errors: the newest few, each cut to two lines, until "Show more" opens the whole list. */
function ErrorLog({ errors }) {
  const [open, setOpen] = useState(false);
  const shown = open ? errors : errors.slice(0, LOG_PREVIEW);
  const hidden = errors.length - LOG_PREVIEW;
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-5">
      <p className="text-sm font-semibold">
        Server error log{errors.length > 0 && <span className="ml-1.5 font-normal text-stone-400">({errors.length})</span>}
      </p>
      <p className="text-xs text-stone-500">Errors the server logged since it started (newest first, last 20). Cleared on restart.</p>
      {errors.length ? (
        <>
          <ul id="server-error-log" className="mt-3 space-y-1.5">
            {shown.map((e) => (
              <li
                key={`${e.at}-${e.message}`}
                className={`rounded-lg bg-stone-50 px-3 py-2 font-mono text-[11px] leading-relaxed break-words text-stone-700 ${open ? '' : 'line-clamp-2'}`}
                title={open ? undefined : e.message}
              >
                <span className="text-stone-400">{clock(e.at)} · </span>
                {e.message}
              </li>
            ))}
          </ul>
          {(hidden > 0 || errors.some((e) => e.message.length > 120)) && (
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              aria-controls="server-error-log"
              className="mt-3 inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-stone-600 hover:bg-stone-100 hover:text-ink"
            >
              {open ? 'Show less' : hidden > 0 ? `Show ${hidden} more` : 'Show full messages'}
              <ChevronDown size={14} aria-hidden="true" className={`transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>
          )}
        </>
      ) : (
        <p className="mt-3 text-sm text-stone-500">No errors logged.</p>
      )}
    </div>
  );
}

/**
 * Admin → System Health: a live flow of the whole site — visitors → Cloudflare/nginx → proxy → pages & API areas →
 * services — with every box green, amber (calls too fast, very busy or slow) or red (server errors, a service down).
 * Polls GET /api/admin/monitor every 5 s while the tab is visible.
 */
export default function LiveFlow({ initial }) {
  const [snap, setSnap] = useState(initial);
  const [selected, setSelected] = useState(null);
  const [lost, setLost] = useState(false);
  // Starts at the snapshot's time so the server and the browser render the same "updated … ago" text.
  const [now, setNow] = useState(() => new Date(initial.at).getTime());

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/monitor', { cache: 'no-store' });
      if (!res.ok) throw new Error(String(res.status));
      setSnap(await res.json());
      setLost(false);
    } catch {
      setLost(true);
    }
  }, []);

  useEffect(() => {
    const tick = () => document.visibilityState === 'visible' && refresh();
    const poll = setInterval(tick, POLL_MS);
    const clockTimer = setInterval(() => setNow(Date.now()), 1000);
    document.addEventListener('visibilitychange', tick);
    const onKey = (e) => e.key === 'Escape' && setSelected(null);
    document.addEventListener('keydown', onKey);
    return () => {
      clearInterval(poll);
      clearInterval(clockTimer);
      document.removeEventListener('visibilitychange', tick);
      document.removeEventListener('keydown', onKey);
    };
  }, [refresh]);

  const node = snap.nodes.find((n) => n.id === selected) ?? null;
  const attention = [
    ...snap.process.issues.map((i) => ({ ...i, where: 'Server' })),
    ...snap.nodes.flatMap((n) => n.issues.map((i) => ({ ...i, where: n.label, id: n.id }))),
  ].sort((a, b) => (a.level === 'error' ? -1 : 1) - (b.level === 'error' ? -1 : 1));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-sm text-stone-600" role="status">
          <span className={`size-2 rounded-full ${lost ? 'bg-red-500' : 'bg-emerald-500 motion-safe:animate-pulse'}`} aria-hidden="true" />
          {lost ? 'Connection lost. Retrying…' : `Live · updated ${ago(snap.at, now)}`}
        </p>
        <ul className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-stone-600" aria-label="Legend">
          {['ok', 'warning', 'error', 'idle'].map((k) => (
            <li key={k} className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full" style={{ background: LEVEL[k].stroke }} aria-hidden="true" />
              {k === 'warning' ? 'Warning (too fast / slow)' : k === 'error' ? 'Error (failing)' : k === 'idle' ? 'Idle (no traffic)' : LEVEL[k].label}
            </li>
          ))}
          <li className="flex items-center gap-1.5">
            <svg width="30" height="10" aria-hidden="true">
              <path d="M1 5 H29" stroke="#059669" strokeOpacity="0.4" strokeWidth="1.75" />
              <circle cx="15" cy="5" r="3" fill="#059669" />
            </svg>
            Moving dots = live requests
          </li>
        </ul>
      </div>

      {!snap.recording && (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Request tracking is off: the site isn’t running through server.js (e.g. plain <code>next dev</code>). Service checks still work; traffic, errors and
          rate-limit numbers appear once it runs with <code>npm run dev</code> / <code>npm start</code>.
        </p>
      )}

      <Summary snap={snap} />

      <div>
        <Diagram nodes={snap.nodes} totals={snap.totals} selected={selected} onSelect={setSelected}>
          {node && (
            <div className="p-3 lg:p-0">
              <Details node={node} now={now} onClose={() => setSelected(null)} />
            </div>
          )}
        </Diagram>
        {!node && <p className="mt-2 text-xs text-stone-500">Click any box to see its traffic, errors and what’s wrong. Hover a box to highlight its connections.</p>}
      </div>

      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <div className="rounded-2xl border border-stone-200 bg-white p-5">
          <p className="text-sm font-semibold">Needs attention</p>
          {attention.length ? (
            <ul className="mt-3 space-y-2">
              {attention.map((i) => (
                <li key={`${i.where}-${i.text}`}>
                  <button
                    type="button"
                    onClick={() => i.id && setSelected(i.id)}
                    className={`flex w-full gap-2 rounded-xl px-3 py-2 text-left text-sm ${i.level === 'error' ? 'bg-red-50 text-red-800' : 'bg-amber-50 text-amber-800'}`}
                  >
                    {i.level === 'error' ? <XCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" /> : <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />}
                    <span>
                      <span className="font-medium">{i.where}:</span> {i.text}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-emerald-700">Everything is running normally.</p>
          )}
        </div>

        <ErrorLog errors={snap.errors} />
      </div>
    </div>
  );
}
