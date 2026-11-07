/**
 * PM2 config for sellpify.com on 13.140.168.178 (next to the rankkw sites).
 *
 * Its own app name and port, so it never touches the other sites on the server.
 * It listens on 127.0.0.1 only: the public reaches it through nginx (which must pass WebSocket upgrades on
 * /socket.io/ for live messaging — see README).
 *
 *   pm2 logs sellpify           # live logs
 *
 * Deploys: bash scripts/deploy.sh
 *
 * Sized from the machine it runs on, like rankkw's ecosystem.config.js, so a bigger server needs no edits
 * (2026-11-08: 8 cores / 23.5 GB, ~4 GB in use). Each env var still overrides.
 */
const os = require('os');

const PORT = Number(process.env.PORT) || 4810;
const CORES = os.cpus().length;
const TOTAL_MB = Math.floor(os.totalmem() / 1024 / 1024);

// Half the cores (2–6): the rankkw sites, nginx and MongoDB share this server and keep the other half.
// 8 cores → 4 workers.
const WORKERS = Number(process.env.WEB_WORKERS) || Math.max(2, Math.min(6, Math.floor(CORES / 2)));
// Heap per worker: a fair share of a quarter of the RAM (the rest is for the other sites, MongoDB, the OS and a
// build), between 768 MB and 2 GB. 23.5 GB / 4 workers → 1.25 GB each. Workers sit around 400–700 MB in practice;
// the cap only stops a runaway worker, which is then replaced by server.js.
const HEAP_MB = Number(process.env.NODE_HEAP_MB) || Math.max(768, Math.min(2048, Math.floor(TOTAL_MB / 4 / WORKERS / 256) * 256));

module.exports = {
  apps: [
    {
      name: 'sellpify',
      // Custom server: Next.js + Socket.IO (live messaging) on one port.
      script: 'server.js',
      // PM2 runs one process; server.js starts WEB_WORKERS workers inside it (Node cluster, sharing the port) and
      // replaces any that crash. Workers inherit node_args, so the heap limit is per worker. Rate limits
      // (lib/rate-limit.js) count per worker, i.e. a little more leniently, as on rankkw.
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
      node_args: `--max-old-space-size=${HEAP_MB}`,
      // The primary only starts and restarts workers and stays small; this is a last-resort safety net for it.
      max_memory_restart: process.env.PM2_MAX_MEMORY || '1G',
      exp_backoff_restart_delay: 200,
      kill_timeout: 8000,
      merge_logs: true,
      time: true,
      env: {
        NODE_ENV: 'production',
        PORT: String(PORT),
        HOST: '127.0.0.1',
        WEB_WORKERS: String(WORKERS),
      },
    },
  ],
};
