/**
 * Production + dev server: Next.js with Socket.IO on the same port (live buyer ↔ seller messaging).
 *
 *   node server.js           production (after `npm run build`)   — `npm start`
 *   node server.js --dev     development with hot reload          — `npm run dev`
 *
 * PORT (default 3000) and HOST (default all interfaces) come from the environment.
 * This file holds no app logic: authentication and database lookups come from the hooks lib/realtime.js
 * installs on globalThis.__realtimeHooks, and the app pushes events through globalThis.__io.
 * Behind nginx, /socket.io/ needs the WebSocket upgrade headers (README → Live messaging).
 */
import { createServer } from 'node:http';
import { Server } from 'socket.io';

const dev = process.argv.includes('--dev');
process.env.NODE_ENV ??= dev ? 'development' : 'production'; // before Next loads
const { default: next } = await import('next');
const port = Number(process.env.PORT) || 3000;
const hostname = process.env.HOST || undefined;

const app = next({ dev, hostname: hostname ?? 'localhost', port });
const handle = app.getRequestHandler();
await app.prepare();
const upgradeNext = app.getUpgradeHandler();

const server = createServer((req, res) => handle(req, res));

const io = new Server(server, {
  path: '/socket.io',
  serveClient: false,
  destroyUpgrade: false, // other upgrades (Next's hot reload) are passed on below, not dropped
  pingInterval: 25_000,
  pingTimeout: 20_000,
  maxHttpBufferSize: 16 * 1024, // clients only send small typing events; messages go through the API
});
globalThis.__io = io;

server.on('upgrade', (req, socket, head) => {
  if (!req.url?.startsWith('/socket.io')) upgradeNext(req, socket, head);
});

// A socket proves who it is with a one-time ticket from POST /api/messages/ticket.
io.use((socket, nextFn) => {
  const userId = globalThis.__realtimeHooks?.authenticate(socket.handshake.auth?.ticket);
  if (!userId) return nextFn(new Error('unauthorized'));
  socket.data.userId = userId;
  nextFn();
});

io.on('connection', (socket) => {
  const { userId } = socket.data;
  socket.join(`user:${userId}`);

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
