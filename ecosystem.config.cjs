/**
 * PM2 config for ecomercemarket.com on 13.140.168.178 (next to the rankkw sites).
 *
 * Its own app name and port, so it never touches the other sites on the server.
 * It listens on 127.0.0.1 only: the public reaches it through nginx.
 *
 *   pm2 logs ecomerce-market           # live logs
 *
 * Deploys: bash scripts/deploy.sh
 */
const PORT = Number(process.env.PORT) || 4800;

module.exports = {
  apps: [
    {
      name: 'ecomerce-market',
      script: 'node_modules/next/dist/bin/next',
      args: `start -p ${PORT} -H 127.0.0.1`,
      // One process: lib/rate-limit.js keeps its counters in memory, so more workers would each count separately.
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
      node_args: `--max-old-space-size=${Number(process.env.NODE_HEAP_MB) || 1024}`,
      max_memory_restart: process.env.PM2_MAX_MEMORY || '1400M',
      exp_backoff_restart_delay: 200,
      kill_timeout: 8000,
      merge_logs: true,
      time: true,
      env: {
        NODE_ENV: 'production',
        PORT: String(PORT),
      },
    },
  ],
};
