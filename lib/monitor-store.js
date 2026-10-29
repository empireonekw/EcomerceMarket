// In-memory request & error recorder for Admin → System Health. server.js feeds it (every request's status and
// time, every console.error); lib/data/monitor.js reads it. Lives on globalThis so the copy server.js loads and the
// copy Next.js bundles share one store. Keeps the last 15 minutes in one-minute buckets — nothing is written to disk
// or the database, and a restart starts fresh. Relative imports only: server.js loads this file with plain Node.
import { monitorEventLoopDelay } from 'node:perf_hooks';
import { nodeForPath } from './monitor-map.js';

const KEEP_MINUTES = 15;
const LATENCY_SAMPLES = 300; // per node, for the p95
const MAX_ERRORS = 60;

const store = (globalThis.__monitorStore ??= {
  startedAt: Date.now(),
  nodes: new Map(), // id → { minutes: Map<minute, bucket>, latencies: number[] }
  errors: [], // newest last: { at, node, message }
  edge: { total: 0, viaCloudflare: 0, https: 0 },
  loop: null,
});

const minuteOf = (t) => Math.floor(t / 60_000);
const emptyBucket = () => ({ requests: 0, serverErrors: 0, rateLimited: 0, clientErrors: 0, totalMs: 0, maxMs: 0 });

function nodeState(id) {
  if (!store.nodes.has(id)) store.nodes.set(id, { minutes: new Map(), latencies: [] });
  return store.nodes.get(id);
}

function prune(state, now) {
  const oldest = minuteOf(now) - KEEP_MINUTES;
  for (const m of state.minutes.keys()) if (m <= oldest) state.minutes.delete(m);
}

/** One finished HTTP request. `headers`: the request headers (to see whether it came through Cloudflare / HTTPS). */
export function recordRequest({ path, status, ms, headers = {} }) {
  if (String(path).startsWith('/api/admin/monitor')) return; // the System Health page polling itself
  const id = nodeForPath(path);
  if (!id) return;
  const now = Date.now();
  const state = nodeState(id);
  const minute = minuteOf(now);
  if (!state.minutes.has(minute)) {
    state.minutes.set(minute, emptyBucket());
    prune(state, now);
  }
  const b = state.minutes.get(minute);
  b.requests += 1;
  if (status >= 500) b.serverErrors += 1;
  else if (status === 429) b.rateLimited += 1;
  else if (status >= 400) b.clientErrors += 1;
  b.totalMs += ms;
  b.maxMs = Math.max(b.maxMs, ms);
  state.latencies.push(ms);
  if (state.latencies.length > LATENCY_SAMPLES) state.latencies.shift();

  store.edge.total += 1;
  if (headers['cf-connecting-ip']) store.edge.viaCloudflare += 1;
  if (headers['x-forwarded-proto'] === 'https') store.edge.https += 1;
}

/** A server-side error (from console.error). Route handlers log as "[POST /api/orders] …", which names the node. */
export function recordError(args) {
  const text = args
    .map((a) => (a instanceof Error ? `${a.name}: ${a.message}` : typeof a === 'string' ? a : (() => { try { return JSON.stringify(a); } catch { return String(a); } })()))
    .join(' ')
    .slice(0, 400);
  const route = /\[(?:[A-Z]+ )?(\/[^\]\s]*)\]/.exec(text)?.[1];
  const area = /^\[(messages|captcha|realtime|socket|field-encryption)/.exec(text)?.[1];
  const node = route ? nodeForPath(route) : { messages: 'messages', captcha: 'recaptcha', realtime: 'socket', socket: 'socket' }[area] ?? null;
  store.errors.push({ at: Date.now(), node, message: text });
  if (store.errors.length > MAX_ERRORS) store.errors.shift();
}

/** Starts measuring how long the event loop is blocked (a busy or stuck server). Called once by server.js. */
export function startEventLoopMonitor() {
  if (store.loop) return;
  store.loop = monitorEventLoopDelay({ resolution: 20 });
  store.loop.enable();
}

export const monitoringActive = () => store.edge.total > 0 || Boolean(store.loop);

/** Totals over the last `minutes` for one node. */
function sum(state, minutes, now) {
  const from = minuteOf(now) - minutes + 1;
  const out = emptyBucket();
  for (const [m, b] of state.minutes) {
    if (m < from) continue;
    out.requests += b.requests;
    out.serverErrors += b.serverErrors;
    out.rateLimited += b.rateLimited;
    out.clientErrors += b.clientErrors;
    out.totalMs += b.totalMs;
    out.maxMs = Math.max(out.maxMs, b.maxMs);
  }
  return out;
}

const p95 = (values) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return Math.round(sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))]);
};

/** Raw numbers for lib/data/monitor.js: per node 1 / 5 / 15-minute totals, p95, a per-minute series; errors; process. */
export function readMonitorStore() {
  const now = Date.now();
  const nodes = {};
  for (const [id, state] of store.nodes) {
    prune(state, now);
    const series = [];
    for (let i = KEEP_MINUTES - 1; i >= 0; i -= 1) series.push(state.minutes.get(minuteOf(now) - i)?.requests ?? 0);
    nodes[id] = { m1: sum(state, 1, now), m5: sum(state, 5, now), m15: sum(state, 15, now), p95: p95(state.latencies), series };
  }
  const loop = store.loop;
  return {
    startedAt: store.startedAt,
    recording: monitoringActive(),
    nodes,
    errors: store.errors.slice(-30).reverse(),
    edge: { ...store.edge },
    eventLoopMs: loop ? { mean: Math.round(loop.mean / 1e6), p99: Math.round(loop.percentile(99) / 1e6), max: Math.round(loop.max / 1e6) } : null,
  };
}

/** Resets the event-loop histogram after each read, so it reflects recent load rather than all-time spikes. */
export function resetEventLoopStats() {
  store.loop?.reset();
}
