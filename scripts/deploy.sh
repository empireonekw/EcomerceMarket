#!/usr/bin/env bash
# Deploy sellpify.com with (almost) no downtime, the same way as the rankkw sites:
# the new build goes into .next-build while the live site keeps serving .next;
# only a complete build is swapped in, then the app restarts and a health check
# runs. A build that does not come up healthy is rolled back by itself.
#
# Usage (on the server, in /www/wwwroot/sellpify):   bash scripts/deploy.sh
# Roll back to the previous build by hand:
#   mv .next .next-bad && mv .next-old .next && pm2 restart sellpify
set -euo pipefail
cd "$(dirname "$0")/.."

APP=sellpify
PORT=${PORT:-4810}
HEALTH="http://127.0.0.1:${PORT}/api/health"

echo "==> Pulling latest code"
git pull --ff-only

# Paid orders must never complete without payment on the live site (lib/payments.js also refuses it there).
if grep -q '^DEMO_CHECKOUT=true' .env.local 2>/dev/null; then
  echo "!! DEMO_CHECKOUT=true in .env.local — it is ignored on the live site, but set it to false: sed -i 's/^DEMO_CHECKOUT=true/DEMO_CHECKOUT=false/' .env.local"
fi

echo "==> Installing packages"
npm ci --no-audit --no-fund

echo "==> Building into .next-build (the live site keeps running meanwhile)"
rm -rf .next-build
if ! NEXT_DIST_DIR=.next-build npm run build; then
  echo
  echo "!! Build failed. The live site was NOT touched and is still running the old version."
  rm -rf .next-build
  exit 1
fi

for f in BUILD_ID required-server-files.json routes-manifest.json prerender-manifest.json server; do
  if [ ! -e ".next-build/$f" ]; then
    echo "!! The new build is incomplete (.next-build/$f is missing). The live site was NOT touched."
    exit 1
  fi
done

# autoIndex is off in production, so indexes are synced on every deploy (README).
echo "==> Syncing database indexes"
npm run db:indexes || echo "!! Index sync failed (the site still works; run: npm run db:indexes)"

# Put build folder $1 in place as .next. `mv -T` never nests a folder inside a
# .next that a live worker just recreated; a non-empty .next is moved aside instead.
swap_in() {
  local src="$1" i
  for i in 1 2 3 4 5 6 7 8 9 10; do
    if mv -T "$src" .next 2>/dev/null; then return 0; fi
    rm -rf .next-stray
    mv -T .next .next-stray 2>/dev/null || true
  done
  return 1
}

echo "==> Swapping in the new build"
rm -rf .next-old .next-stray
if [ -d .next ]; then mv -T .next .next-old; fi
if ! swap_in .next-build || [ ! -f .next/BUILD_ID ]; then
  echo "!! Could not put the new build in place. Restoring the previous one."
  [ -d .next-old ] && swap_in .next-old || true
  pm2 restart "$APP" --update-env || true
  exit 1
fi
rm -rf .next-stray

echo "==> Restarting"
if pm2 describe "$APP" >/dev/null 2>&1; then
  pm2 restart "$APP" --update-env
else
  pm2 start ecosystem.config.cjs
fi
pm2 save >/dev/null

echo "==> Health check"
healthy=0
for i in $(seq 1 18); do
  sleep 5
  if curl -s -m 10 "$HEALTH" | grep -q '"status":"ok"'; then healthy=1; break; fi
done
if [ "$healthy" = 1 ]; then
  curl -s -m 10 "$HEALTH" || true; echo
  echo "Done. Previous build kept in .next-old."
else
  echo "!! The new build did not come up healthy in 90 s. Rolling back to the previous build."
  pm2 logs "$APP" --err --lines 20 --nostream 2>/dev/null | tail -20 || true
  if [ -d .next-old ]; then
    rm -rf .next-failed; mv -T .next .next-failed || true; swap_in .next-old || true
    pm2 restart "$APP" --update-env || true
    echo "!! Rolled back. The failed build is kept in .next-failed for inspection."
  fi
  exit 1
fi
