// `npm run dev`: starts the dev server (server.js --dev). When .env.development.local sets DEV_DB_TUNNEL, it first
// opens the SSH tunnel to the server's MongoDB itself (and reopens it if it drops), so nobody has to start one by
// hand. The tunnel closes with the dev server. Without DEV_DB_TUNNEL this is just `node server.js --dev`.
//
//   DEV_DB_TUNNEL=root@13.140.168.178              who to connect as
//   DEV_DB_TUNNEL_KEY=~/.ssh/sellpify_dev_tunnel   the tunnel-only key (README → Local development)
//   MONGODB_URI=mongodb://…@127.0.0.1:27020/…      the local end of the tunnel = the port in this URI
import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';

const ENV_FILE = '.env.development.local';

function readEnvFile(file) {
  if (!existsSync(file)) return {};
  const vars = {};
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m) vars[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
  }
  return vars;
}

const portIsOpen = (port) =>
  new Promise((resolve) => {
    const socket = net.connect({ host: '127.0.0.1', port }, () => { socket.destroy(); resolve(true); });
    socket.on('error', () => resolve(false));
    socket.setTimeout(1000, () => { socket.destroy(); resolve(false); });
  });

const env = readEnvFile(ENV_FILE);
const target = env.DEV_DB_TUNNEL;
const localPort = Number(env.MONGODB_URI?.match(/@127\.0\.0\.1:(\d+)\//)?.[1]);
const key = path.normalize((env.DEV_DB_TUNNEL_KEY || '~/.ssh/sellpify_dev_tunnel').replace(/^~(?=[\\/])/, os.homedir()));
let tunnel = null;
let stopping = false;
let everConnected = false;

function openTunnel() {
  tunnel = spawn(
    'ssh',
    [
      '-i', key,
      '-o', 'IdentitiesOnly=yes',
      '-o', 'BatchMode=yes', // never wait for a password prompt
      '-o', 'StrictHostKeyChecking=accept-new',
      '-o', 'ExitOnForwardFailure=yes',
      '-o', 'ServerAliveInterval=30',
      '-N', '-L', `${localPort}:127.0.0.1:27017`, target,
    ],
    { stdio: ['ignore', 'ignore', 'inherit'] },
  );
  tunnel.on('error', (err) => console.error(`[db-tunnel] Could not run ssh: ${err.message}`));
  tunnel.on('exit', () => {
    tunnel = null;
    if (stopping) return;
    if (!everConnected) {
      // Never got in (key not allowed on the server yet, wrong user, no network): retrying won't help.
      console.error('[db-tunnel] Could not connect to the database server (see the ssh message above).');
      console.error('[db-tunnel] New on this project? Run  npm run dev:key  and send the command it prints to the server admin.');
      return;
    }
    console.error('[db-tunnel] Connection to the database server closed; reconnecting in 5 s…');
    setTimeout(() => { if (!stopping) openTunnel(); }, 5000);
  });
}

if (target && localPort && !existsSync(key)) {
  console.warn(`[db-tunnel] No SSH key at ${key}, so no connection to the database server.`);
  console.warn('[db-tunnel] Run  npm run dev:key  once and send the command it prints to the server admin.');
} else if (target && localPort) {
  if (await portIsOpen(localPort)) {
    console.log(`[db-tunnel] Port ${localPort} is already open (a tunnel is running); using it.`);
  } else {
    openTunnel();
    let up = false;
    for (let i = 0; i < 20 && !up; i++) {
      await new Promise((r) => setTimeout(r, 500));
      up = await portIsOpen(localPort);
    }
    everConnected = up;
    console.log(up
      ? `[db-tunnel] Connected: 127.0.0.1:${localPort} → MongoDB on ${target.split('@').pop()}`
      : `[db-tunnel] Tunnel not up yet on port ${localPort}; pages that need the database will fail until it is.`);
  }
} else if (target) {
  console.warn(`[db-tunnel] DEV_DB_TUNNEL is set but MONGODB_URI in ${ENV_FILE} has no 127.0.0.1:<port>; no tunnel opened.`);
}

const server = spawn(process.execPath, ['server.js', '--dev'], { stdio: 'inherit' });

function stop() {
  stopping = true;
  tunnel?.kill();
}
// Ctrl+C reaches the dev server too; wait for it to exit, then close the tunnel.
process.on('SIGINT', () => {});
process.on('SIGTERM', () => server.kill('SIGTERM'));
server.on('exit', (code) => {
  stop();
  process.exit(code ?? 0);
});
