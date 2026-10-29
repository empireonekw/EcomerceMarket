import 'server-only';
import { access, constants } from 'node:fs/promises';
import path from 'node:path';
import mongoose from 'mongoose';
import { connectDB } from '@/lib/mongodb';
import { MONITOR_NODES } from '@/lib/monitor-map';
import { readMonitorStore, resetEventLoopStats } from '@/lib/monitor-store';
import { isDemoCheckout } from '@/lib/payments';
import { uploadDriver } from '@/lib/uploads';
import { siteConfig } from '@/lib/site';

// Admin → System Health. Turns the request recorder's numbers into a status per node — error (red), warning (amber),
// ok (green) or idle (grey) — with the reasons in plain words, and checks each service directly. Callers authorize.

/** When a node turns amber. */
const THRESHOLDS = {
  // 95% of requests should finish faster than this. Login / sign-up are slower by design: the password hash is
  // deliberately slow (~0.3 s) and the "I'm not a robot" check asks Google.
  slowP95Ms: { default: 1500, auth: 3000 },
  highRpm: { pages: 900, files: 1200, catalog: 600, default: 300, auth: 90, contact: 20, checkout: 60 }, // requests per minute
  dbSlowMs: 500,
  eventLoopWarnMs: 200, // the server is busy / blocked
};

const isProd = process.env.NODE_ENV === 'production';
const LEVEL_RANK = { error: 3, warning: 2, ok: 1, idle: 0, info: 0 };
const worst = (levels) => levels.reduce((a, b) => (LEVEL_RANK[b] > LEVEL_RANK[a] ? b : a), 'idle');
const withTimeout = (promise, ms) => Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error(`no answer in ${ms / 1000}s`)), ms))]);

/** Status of a page / API node from its traffic. */
function routeStatus(id, stats) {
  if (!stats || stats.m15.requests === 0) return { level: 'idle', issues: [] };
  const issues = [];
  if (stats.m5.serverErrors > 0) issues.push({ level: 'error', text: `${stats.m5.serverErrors} server error${stats.m5.serverErrors === 1 ? '' : 's'} (5xx) in the last 5 min` });
  if (stats.m5.rateLimited > 0) issues.push({ level: 'warning', text: `Calls too fast: rate-limited ${stats.m5.rateLimited}× in the last 5 min` });
  const limit = THRESHOLDS.highRpm[id] ?? THRESHOLDS.highRpm.default;
  if (stats.m1.requests > limit) issues.push({ level: 'warning', text: `Very high traffic: ${stats.m1.requests} requests in the last minute (normal < ${limit})` });
  const slow = THRESHOLDS.slowP95Ms[id] ?? THRESHOLDS.slowP95Ms.default;
  if (stats.p95 != null && stats.p95 > slow) {
    // npm run dev compiles each route on its first request and reaches the database through the SSH tunnel.
    const why = isProd ? '' : ' (local dev: includes compiling and the database tunnel; check the live site before worrying)';
    issues.push({ level: 'warning', text: `Slow: 95% of requests take up to ${stats.p95} ms (normal < ${slow})${why}` });
  }
  return { level: issues.length ? worst(issues.map((i) => i.level)) : 'ok', issues };
}

async function probeMongo() {
  const started = Date.now();
  try {
    await withTimeout(connectDB(), 5000);
    await withTimeout(mongoose.connection.db.admin().ping(), 3000);
    const ms = Date.now() - started;
    return ms > THRESHOLDS.dbSlowMs
      ? { level: 'warning', detail: `Responding slowly (${ms} ms)`, issues: [{ level: 'warning', text: `Database ping took ${ms} ms` }], metrics: { pingMs: ms } }
      : { level: 'ok', detail: `Connected · ping ${ms} ms`, issues: [], metrics: { pingMs: ms } };
  } catch (err) {
    return { level: 'error', detail: 'Not reachable', issues: [{ level: 'error', text: `Database check failed: ${err.message}` }], metrics: {} };
  }
}

function probeSocket() {
  const io = globalThis.__io;
  if (!io) {
    return { level: 'warning', detail: 'Not running', issues: [{ level: 'warning', text: 'Live messaging is off (the site was not started with server.js) — inboxes fall back to refreshing every 20 s.' }], metrics: {} };
  }
  const clients = io.engine?.clientsCount ?? 0;
  return { level: 'ok', detail: `${clients} live connection${clients === 1 ? '' : 's'}`, issues: [], metrics: { connections: clients } };
}

async function probeStorage() {
  const driver = uploadDriver();
  if (driver === 'blob') return { level: 'ok', detail: 'Vercel Blob', issues: [], metrics: {} };
  if (!driver) return { level: 'error', detail: 'No storage', issues: [{ level: 'error', text: 'Uploads are off: set BLOB_READ_WRITE_TOKEN (the server disk is read-only here).' }], metrics: {} };
  const dir = path.resolve(/*turbopackIgnore: true*/ process.env.UPLOAD_DIR || path.join(/*turbopackIgnore: true*/ process.cwd(), 'uploads'));
  try {
    await access(dir, constants.W_OK);
    return { level: 'ok', detail: 'Server disk (writable)', issues: [], metrics: {} };
  } catch (err) {
    if (err.code === 'ENOENT') return { level: 'ok', detail: 'Server disk (folder created on first upload)', issues: [], metrics: {} };
    return { level: 'error', detail: 'Disk not writable', issues: [{ level: 'error', text: `Can’t write to the upload folder (${err.code}).` }], metrics: {} };
  }
}

function probeRecaptcha() {
  const site = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
  const secret = process.env.RECAPTCHA_SECRET_KEY;
  if (site && secret) {
    const test = site.startsWith('6LeIxAcTAAAAA');
    return test
      ? { level: isProd ? 'warning' : 'ok', detail: 'Google test keys', issues: isProd ? [{ level: 'warning', text: 'Using Google’s test keys — every check passes. Set your real keys.' }] : [], metrics: {} }
      : { level: 'ok', detail: 'Protecting login & sign-up', issues: [], metrics: {} };
  }
  return { level: 'warning', detail: 'Not configured', issues: [{ level: 'warning', text: 'reCAPTCHA keys are missing — login and sign-up have no “I’m not a robot” check.' }], metrics: {} };
}

function probePayments() {
  if (isDemoCheckout()) {
    return { level: 'warning', detail: 'Demo checkout', issues: [{ level: 'warning', text: 'Demo checkout: paid orders complete without payment (local testing only).' }], metrics: {} };
  }
  const name = siteConfig.paymentProvider;
  return {
    level: 'warning',
    detail: name ? `${name} (not connected)` : 'No gateway connected',
    issues: [{ level: 'warning', text: 'No payment gateway is connected yet — only free products can be checked out (lib/payments.js).' }],
    metrics: {},
  };
}

function edgeStatus(edge, totalRequests) {
  if (!totalRequests) return { level: 'idle', detail: 'No traffic yet', issues: [] };
  if (!isProd) return { level: 'ok', detail: 'Local development', issues: [] };
  const share = (n) => Math.round((n / edge.total) * 100);
  const issues = [];
  if (edge.https < edge.total) issues.push({ level: 'warning', text: `${100 - share(edge.https)}% of requests didn’t arrive over HTTPS` });
  if (edge.viaCloudflare < edge.total) issues.push({ level: 'warning', text: `${100 - share(edge.viaCloudflare)}% of requests bypassed Cloudflare (server reached directly)` });
  return { level: issues.length ? 'warning' : 'ok', detail: `${share(edge.viaCloudflare)}% via Cloudflare · ${share(edge.https)}% HTTPS`, issues };
}

const routeDetail = (s) => (s && s.m15.requests ? `${s.m1.requests}/min${s.p95 != null ? ` · p95 ${s.p95} ms` : ''}` : 'No traffic');

/** Everything the System Health page shows. */
export async function getSystemSnapshot() {
  const raw = readMonitorStore();
  resetEventLoopStats();
  const [mongodb, storage] = await Promise.all([probeMongo(), probeStorage()]);
  const services = { mongodb, socket: probeSocket(), storage, recaptcha: probeRecaptcha(), payments: probePayments() };

  const totals = Object.values(raw.nodes).reduce(
    (t, n) => ({
      rpm: t.rpm + n.m1.requests,
      m5: t.m5 + n.m5.requests,
      serverErrors: t.serverErrors + n.m5.serverErrors,
      rateLimited: t.rateLimited + n.m5.rateLimited,
    }),
    { rpm: 0, m5: 0, serverErrors: 0, rateLimited: 0 },
  );
  const allLatencyP95 = Math.max(0, ...Object.values(raw.nodes).map((n) => n.p95 ?? 0));

  const nodes = MONITOR_NODES.map((def) => {
    const stats = raw.nodes[def.id];
    let status;
    if (def.kind === 'route') status = { ...routeStatus(def.id, stats), detail: routeDetail(stats) };
    else if (def.kind === 'service') status = services[def.id];
    else if (def.id === 'proxy') {
      status = !totals.m5 && !raw.recording
        ? { level: 'idle', detail: 'No traffic yet', issues: [] }
        : totals.rateLimited
          ? { level: 'warning', detail: `${totals.rateLimited} request${totals.rateLimited === 1 ? '' : 's'} blocked (429)`, issues: [{ level: 'warning', text: `Blocked ${totals.rateLimited} too-fast request${totals.rateLimited === 1 ? '' : 's'} in the last 5 min` }] }
          : { level: 'ok', detail: `${totals.rpm}/min passing`, issues: [] };
    } else if (def.id === 'edge') status = edgeStatus(raw.edge, totals.m5);
    else status = { level: totals.m5 ? 'ok' : 'idle', detail: `${totals.rpm} requests/min`, issues: [] };

    const errors = raw.errors.filter((e) => e.node === def.id).slice(0, 8);
    return {
      ...def,
      level: status.level,
      detail: status.detail,
      issues: status.issues ?? [],
      stats: stats ? { lastMinute: stats.m1, last5: stats.m5, last15: stats.m15, p95: stats.p95, series: stats.series } : null,
      metrics: status.metrics ?? {},
      recentErrors: errors,
    };
  });

  const mem = process.memoryUsage();
  const loop = raw.eventLoopMs;
  const processIssues = loop && loop.p99 > THRESHOLDS.eventLoopWarnMs ? [{ level: 'warning', text: `Server busy: event loop delayed up to ${loop.p99} ms` }] : [];

  return {
    at: new Date().toISOString(),
    recording: raw.recording,
    overall: worst([...nodes.map((n) => n.level), ...processIssues.map((i) => i.level)]),
    totals: { ...totals, p95: allLatencyP95 || null },
    process: {
      uptimeSec: Math.round(process.uptime()),
      monitoringSinceSec: Math.round((Date.now() - raw.startedAt) / 1000),
      rssMb: Math.round(mem.rss / 1048576),
      heapMb: Math.round(mem.heapUsed / 1048576),
      eventLoopMs: loop,
      node: process.version,
      issues: processIssues,
    },
    nodes,
    errors: raw.errors.slice(0, 20),
  };
}
