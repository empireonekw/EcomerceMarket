'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, AlertTriangle, Clock, Cpu, Gauge, ShieldAlert, XCircle } from 'lucide-react';
import { MONITOR_EDGES } from '@/lib/monitor-map';

const POLL_MS = 5000;

const LEVEL = {
  error: { label: 'Error', stroke: '#dc2626', fill: '#fef2f2', text: 'text-red-700', chip: 'bg-red-50 text-red-700 ring-red-600/20' },
  warning: { label: 'Warning', stroke: '#d97706', fill: '#fffbeb', text: 'text-amber-700', chip: 'bg-amber-50 text-amber-700 ring-amber-600/20' },
  ok: { label: 'Healthy', stroke: '#059669', fill: '#ecfdf5', text: 'text-emerald-700', chip: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20' },
  idle: { label: 'Idle', stroke: '#a8a29e', fill: '#f5f5f4', text: 'text-stone-600', chip: 'bg-stone-100 text-stone-600 ring-stone-500/20' },
};

// Diagram geometry (viewBox units): five columns, left → right.
const COLS = [
  { x: 16, w: 150 },
  { x: 214, w: 176 },
  { x: 438, w: 176 },
  { x: 680, w: 214 },
  { x: 968, w: 206 },
];
const NODE_H = 48;
const ROW_GAP = 64;
const TOP = 24;
const WIDTH = 1190;

function layout(nodes) {
  const byCol = COLS.map((_, c) => nodes.filter((n) => n.col === c));
  const rows = Math.max(...byCol.map((list) => list.length));
  const height = TOP * 2 + (rows - 1) * ROW_GAP + NODE_H;
  const pos = {};
  byCol.forEach((list, c) => {
    // Spread each column over the full height so short columns sit centred against the long one.
    const span = (rows - 1) * ROW_GAP;
    list.forEach((n, i) => {
      const y = list.length === 1 ? TOP + span / 2 : TOP + (span * i) / (list.length - 1);
      pos[n.id] = { x: COLS[c].x, y, w: COLS[c].w, row: i };
    });
  });
  return { pos, height };
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
    { label: 'Overall', value: LEVEL[snap.overall]?.label ?? '—', icon: Activity, tone: snap.overall },
    { label: 'Requests / min', value: totals.rpm, icon: Gauge, tone: 'idle' },
    { label: 'Server errors (5 min)', value: totals.serverErrors, icon: XCircle, tone: totals.serverErrors ? 'error' : 'ok' },
    { label: 'Rate-limited (5 min)', value: totals.rateLimited, icon: ShieldAlert, tone: totals.rateLimited ? 'warning' : 'ok' },
    { label: 'Slowest p95', value: totals.p95 != null ? `${totals.p95} ms` : '—', icon: Clock, tone: totals.p95 > 1500 ? 'warning' : 'idle' },
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

/** The flow diagram: boxes coloured by status, arrows by the status of where they lead; dashes move while traffic flows. */
function Diagram({ nodes, selected, onSelect }) {
  const { pos, height } = useMemo(() => layout(nodes), [nodes]);
  const byId = useMemo(() => Object.fromEntries(nodes.map((n) => [n.id, n])), [nodes]);
  const busy = (n) => (n?.stats?.lastMinute?.requests ?? 0) > 0 || (n?.metrics?.connections ?? 0) > 0;

  return (
    <div className="overflow-x-auto rounded-2xl border border-stone-200 bg-white">
      <svg viewBox={`0 0 ${WIDTH} ${height}`} className="block h-auto min-w-[1000px] w-full" role="group" aria-label="Live system flow">
        {/* Arrows first, so boxes sit on top. */}
        {MONITOR_EDGES.map(([from, to], i) => {
          const a = pos[from];
          const b = pos[to];
          if (!a || !b) return null;
          const target = byId[to];
          const level = target?.level ?? 'idle';
          const x1 = a.x + a.w;
          const y1 = a.y + NODE_H / 2;
          const x2 = b.x - 6;
          const y2 = b.y + NODE_H / 2;
          const mid = x1 + Math.max(14, (x2 - x1) / 2) + (a.row % 4) * 6 - 9;
          const flowing = busy(byId[from]) && busy(target);
          const dimmed = selected && from !== selected && to !== selected;
          return (
            <g key={`${from}-${to}-${i}`} opacity={dimmed ? 0.18 : 1}>
              <path
                d={`M ${x1} ${y1} H ${mid} V ${y2} H ${x2}`}
                fill="none"
                stroke={LEVEL[level].stroke}
                strokeWidth={level === 'idle' ? 1.25 : 2}
                strokeDasharray={flowing ? '6 4' : level === 'idle' ? '3 4' : undefined}
                className={flowing ? 'motion-safe:animate-flow' : undefined}
              />
              <path d={`M ${x2 - 1} ${y2 - 5} L ${x2 + 6} ${y2} L ${x2 - 1} ${y2 + 5} Z`} fill={LEVEL[level].stroke} />
            </g>
          );
        })}

        {nodes.map((n) => {
          const p = pos[n.id];
          const l = LEVEL[n.level] ?? LEVEL.idle;
          const external = n.kind === 'external' && n.level === 'idle';
          const isSelected = selected === n.id;
          return (
            <g
              key={n.id}
              role="button"
              tabIndex={0}
              aria-pressed={isSelected}
              aria-label={`${n.label}: ${l.label}. ${n.detail ?? ''}`}
              onClick={() => onSelect(isSelected ? null : n.id)}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onSelect(isSelected ? null : n.id))}
              className="cursor-pointer outline-none [&:focus-visible>rect]:stroke-[3]"
              opacity={selected && !isSelected && !MONITOR_EDGES.some(([f, t]) => (f === selected && t === n.id) || (t === selected && f === n.id)) ? 0.35 : 1}
            >
              {n.level === 'error' && <rect x={p.x - 4} y={p.y - 4} width={p.w + 8} height={NODE_H + 8} rx={16} fill="none" stroke={l.stroke} strokeOpacity={0.35} strokeWidth={4} className="motion-safe:animate-pulse" />}
              <rect x={p.x} y={p.y} width={p.w} height={NODE_H} rx={12} fill={external ? '#fff' : l.fill} stroke={isSelected ? '#141414' : l.stroke} strokeWidth={isSelected ? 2.5 : 1.5} />
              <circle cx={p.x + 14} cy={p.y + 17} r={4.5} fill={l.stroke} />
              <text x={p.x + 26} y={p.y + 21} fontSize="13" fontWeight="600" fill="#141414">
                {n.label}
              </text>
              <text x={p.x + 14} y={p.y + 37} fontSize="11" fill="#57534e">
                {(n.detail || n.sub || '').slice(0, Math.floor(p.w / 6.2))}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function Sparkline({ series }) {
  const max = Math.max(1, ...series);
  return (
    <svg viewBox={`0 0 ${series.length * 8} 32`} className="h-8 w-full" aria-label="Requests per minute, last 15 minutes">
      {series.map((v, i) => (
        <rect key={i} x={i * 8 + 1} y={32 - (v / max) * 30} width={6} height={Math.max(1, (v / max) * 30)} rx={1.5} fill={v ? '#4d49fc' : '#e7e5e4'} />
      ))}
    </svg>
  );
}

function Details({ node, now }) {
  if (!node) {
    return (
      <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-5 text-sm text-stone-500">
        Click any box in the flow to see its traffic, errors and what’s wrong.
      </div>
    );
  }
  const s = node.stats;
  const avg = s?.last5?.requests ? Math.round(s.last5.totalMs / s.last5.requests) : null;
  const rows = s
    ? [
        ['Requests (last min)', s.lastMinute.requests],
        ['Requests (5 min)', s.last5.requests],
        ['Server errors 5xx (5 min)', s.last5.serverErrors],
        ['Rate-limited 429 (5 min)', s.last5.rateLimited],
        ['Client errors 4xx (5 min)', s.last5.clientErrors],
        ['Average response', avg != null ? `${avg} ms` : '—'],
        ['95% under', s.p95 != null ? `${s.p95} ms` : '—'],
      ]
    : Object.entries(node.metrics ?? {}).map(([k, v]) => [k === 'pingMs' ? 'Ping' : k === 'connections' ? 'Live connections' : k, k === 'pingMs' ? `${v} ms` : v]);

  return (
    <div className="space-y-4 rounded-2xl border border-stone-200 bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-lg font-semibold">{node.label}</p>
          <p className="text-sm text-stone-500">{node.sub}</p>
        </div>
        <LevelChip level={node.level} />
      </div>
      {node.detail && <p className="text-sm text-stone-700">{node.detail}</p>}

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
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-stone-500">Recent errors</p>
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
  const [now, setNow] = useState(() => Date.now());

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
    return () => {
      clearInterval(poll);
      clearInterval(clockTimer);
      document.removeEventListener('visibilitychange', tick);
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
          {lost ? 'Connection lost — retrying…' : `Live · updated ${ago(snap.at, now)}`}
        </p>
        <ul className="flex flex-wrap items-center gap-3 text-xs text-stone-600" aria-label="Legend">
          {['ok', 'warning', 'error', 'idle'].map((k) => (
            <li key={k} className="flex items-center gap-1.5">
              <span className="size-3 rounded border" style={{ background: LEVEL[k].fill, borderColor: LEVEL[k].stroke }} aria-hidden="true" />
              {k === 'warning' ? 'Warning (too fast / slow)' : k === 'error' ? 'Error (failing)' : LEVEL[k].label}
            </li>
          ))}
          <li className="flex items-center gap-1.5">
            <svg width="26" height="8" aria-hidden="true">
              <path d="M0 4 H20" stroke="#059669" strokeWidth="2" strokeDasharray="6 4" className="motion-safe:animate-flow" />
              <path d="M19 0 L26 4 L19 8 Z" fill="#059669" />
            </svg>
            Live traffic
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

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem] xl:items-start">
        <Diagram nodes={snap.nodes} selected={selected} onSelect={setSelected} />
        <div className="space-y-6 xl:sticky xl:top-6">
          <Details node={node} now={now} />
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
        </div>
      </div>

      <div className="rounded-2xl border border-stone-200 bg-white p-5">
        <p className="text-sm font-semibold">Server error log</p>
        <p className="text-xs text-stone-500">Errors the server logged since it started (newest first, last 20). Cleared on restart.</p>
        {snap.errors.length ? (
          <ul className="mt-3 space-y-1.5">
            {snap.errors.map((e) => (
              <li key={`${e.at}-${e.message}`} className="rounded-lg bg-stone-50 px-3 py-2 font-mono text-[11px] leading-relaxed text-stone-700">
                <span className="text-stone-400">{clock(e.at)} · </span>
                {e.message}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-stone-500">No errors logged.</p>
        )}
      </div>
    </div>
  );
}
