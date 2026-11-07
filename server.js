/**
 * Production + dev server: Next.js with Socket.IO on the same port (live buyer ↔ seller messaging).
 *
 *   node server.js           production (after `npm run build`)   — `npm start`
 *   node server.js --dev     development with hot reload          — `npm run dev`
 *
 * PORT (default 3000) and HOST (default all interfaces) come from the environment.
 *
 * Production runs WEB_WORKERS processes (default: half the CPU cores, 4 on this server) on the one port, like rankkw's PM2 cluster: a slow page or a
 * burst no longer makes every other request wait on a single CPU core, and a crashed worker is replaced while the
 * others keep serving. The primary process only starts and restarts workers. Live messaging across workers:
 *  - sockets connect over WebSocket only, so each connection stays on one worker (no sticky sessions needed);
 *  - tickets are signed (lib/socket-ticket.js), so any worker can check one another worker issued;
 *  - events reach sockets on other workers through MongoDB (@socket.io/mongo-adapter, a change stream).
 * This file holds no app logic: the app pushes events through globalThis.__io and the typing relay asks the hook
 * lib/realtime.js installs on globalThis.__realtimeHooks. It also feeds the in-memory request monitor behind
 * Admin → System Health (lib/monitor-store.js), per worker.
 * Behind nginx, /socket.io/ needs the WebSocket upgrade headers (README → Live messaging).
 */
import cluster from 'node:cluster';
import os from 'node:os';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { Server } from 'socket.io';
import { recordError, recordRequest, startEventLoopMonitor } from './lib/monitor-store.js';
import { verifySocketTicket } from './lib/socket-ticket.js';

const dev = process.argv.includes('--dev');
process.env.NODE_ENV ??= dev ? 'development' : 'production'; // before Next loads
// Half the CPU cores (2–6), as in ecosystem.config.cjs; set here too because `pm2 restart` keeps the env a process
// was first started with. 8 cores → 4 workers.
const WORKERS = dev ? 1 : Math.max(1, Number(process.env.WEB_WORKERS) || Math.max(2, Math.min(6, Math.floor(os.cpus().length / 2))));

if (WORKERS > 1 && cluster.isPrimary) {
  startPrimary();
} else {
  await startWorker();
}

/** Starts the workers, replaces any that exit (backing off if one keeps crashing) and stops them all on shutdown. */
function startPrimary() {
  let stopping = false;
  const recentExits = [];
  const fork = () => cluster.fork();
  for (let i = 0; i < WORKERS; i++) fork();
  cluster.on('exit', (worker, code, signal) => {
    if (stopping) return;
    const now = Date.now();
    recentExits.push(now);
    while (recentExits.length && now - recentExits[0] > 60_000) recentExits.shift();
    console.error(`[cluster] worker ${worker.process.pid} exited (${signal ?? code}); starting a new one`);
    setTimeout(fork, recentExits.length > WORKERS * 2 ? 5_000 : 200); // crash loop: slow down
  });
  const stop = () => {
    stopping = true;
    for (const worker of Object.values(cluster.workers ?? {})) worker?.process.kill('SIGTERM');
    setTimeout(() => process.exit(0), 9_000).unref();
    cluster.on('exit', () => Object.keys(cluster.workers ?? {}).length === 0 && process.exit(0));
  };
  process.on('SIGTERM', stop);
  process.on('SIGINT', stop);
  console.log(`> Sellpify: ${WORKERS} workers on port ${Number(process.env.PORT) || 3000}`);
}

/**
 * Socket.IO events between workers through a small capped MongoDB collection. Without a reachable database (or a
 * standalone one) it stays in-process, which is exactly right for a single worker.
 */
async function useMongoAdapter(io) {
  const uri = process.env.MONGODB_URI;
  if (!uri || WORKERS === 1) return;
  try {
    const [{ MongoClient }, { createAdapter }] = await Promise.all([import('mongodb'), import('@socket.io/mongo-adapter')]);
    const single = /^mongodb:\/\/(?:[^@/]*@)?[^/?,]+(?:[/?]|$)/.test(uri) && !/[?&](replicaSet|directConnection)=/i.test(uri);
    const client = new MongoClient(uri, single ? { directConnection: true } : {});
    await client.connect();
    const db = client.db();
    const NAME = 'socket.io-events';
    if (!(await db.listCollections({ name: NAME }).hasNext())) {
      await db.createCollection(NAME, { capped: true, size: 2_000_000 }).catch(() => {}); // another worker may win
    }
    io.adapter(createAdapter(db.collection(NAME)));
  } catch (err) {
    console.error('[socket] Cross-worker events unavailable, live updates stay within each worker:', err.message);
  }
}

async function startWorker() {
const { default: next } = await import('next');
const port = Number(process.env.PORT) || 3000;
const hostname = process.env.HOST || undefined;

// An absolute project dir: with a relative one, Turbopack's watcher doesn't skip the build folder, so every write to
// its dev log counts as a code change and the browser reloads in a loop.
const dir = fileURLToPath(new URL('.', import.meta.url));
const app = next({ dev, dir, hostname: hostname ?? 'localhost', port });
const handle = app.getRequestHandler();
await app.prepare();
const upgradeNext = app.getUpgradeHandler();

// Admin → System Health (lib/monitor-store.js): every request's status and time, every logged error, event-loop lag.
startEventLoopMonitor();
const logError = console.error.bind(console);
console.error = (...args) => {
  try {
    recordError(args);
  } catch {
    // never let monitoring break logging
  }
  logError(...args);
};

const server = createServer((req, res) => {
  const started = performance.now();
  res.on('finish', () => recordRequest({ path: req.url, status: res.statusCode, ms: Math.round(performance.now() - started), headers: req.headers }));
  handle(req, res);
});

const io = new Server(server, {
  path: '/socket.io',
  serveClient: false,
  destroyUpgrade: false, // other upgrades (Next's hot reload) are passed on below, not dropped
  pingInterval: 25_000,
  pingTimeout: 20_000,
  maxHttpBufferSize: 16 * 1024, // clients only send small typing events; messages go through the API
});
globalThis.__io = io;
await useMongoAdapter(io); // after app.prepare(): Next has loaded MONGODB_URI from .env.local

server.on('upgrade', (req, socket, head) => {
  if (!req.url?.startsWith('/socket.io')) upgradeNext(req, socket, head);
});

// A socket proves who it is with a one-time ticket from POST /api/messages/ticket.
io.use((socket, nextFn) => {
  const identity = verifySocketTicket(socket.handshake.auth?.ticket);
  if (!identity) return nextFn(new Error('unauthorized'));
  socket.data.userId = identity.userId;
  socket.data.rooms = identity.rooms ?? [];
  nextFn();
});

io.on('connection', (socket) => {
  const { userId } = socket.data;
  socket.join([`user:${userId}`, ...socket.data.rooms]);

  // "…is typing": relayed only to the other participant of a thread this user belongs to. Relays are chained so a
  // slow membership lookup can't deliver "stopped typing" before the "typing" that came first.
  let lastTypingAt = 0;
  let relay = Promise.resolve();
  socket.on('typing', (payload) => {
    const conversationId = typeof payload?.conversationId === 'string' ? payload.conversationId : null;
    const typing = Boolean(payload?.typing);
    if (!conversationId) return;
    if (typing && Date.now() - lastTypingAt < 1000) return;
    lastTypingAt = typing ? Date.now() : 0;
    relay = relay.then(async () => {
      try {
        const peer = await globalThis.__realtimeHooks?.peerOf(userId, conversationId);
        if (peer) io.to(`user:${peer}`).emit('typing', { conversationId, typing });
      } catch (err) {
        console.error('[socket] typing relay failed', err);
      }
    });
  });
});

server.listen(port, hostname, () => {
  console.log(`> Ready on http://${hostname ?? 'localhost'}:${port} (${dev ? 'development' : 'production'}, live messaging on)`);
});

function shutdown() {
  io.close();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 8000).unref();
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
}
