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
 */
const PORT = Number(process.env.PORT) || 4810;

module.exports = {
  apps: [
    {
      name: 'sellpify',
      // Custom server: Next.js + Socket.IO (live messaging) on one port. PM2 runs one process; server.js starts
      // WEB_WORKERS workers inside it (Node cluster, sharing the port) and replaces any that crash. Each worker
      // inherits node_args, so the heap limit below is per worker. Rate limits (lib/rate-limit.js) count per worker,
      // i.e. a little more leniently, as on rankkw.
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
      node_args: `--max-old-space-size=${Number(process.env.NODE_HEAP_MB) || 1024}`,
      max_memory_restart: process.env.PM2_MAX_MEMORY || '1400M', // the primary only; workers are capped by node_args
      exp_backoff_restart_delay: 200,
      kill_timeout: 8000,
      merge_logs: true,
      time: true,
      env: {
        NODE_ENV: 'production',
        PORT: String(PORT),
        HOST: '127.0.0.1',
        // 3 of the server's 8 cores (the rankkw sites use the rest). Raise if Sellpify gets busier.
        WEB_WORKERS: process.env.WEB_WORKERS || '3',
      },
    },
  ],
};
