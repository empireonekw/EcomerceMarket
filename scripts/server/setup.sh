#!/usr/bin/env bash
# One-time setup of sellpify.com on 13.140.168.178 (run as root, from the
# cloned repo). Safe to re-run.
#
#   git clone https://github.com/empireonekw/EcomerceMarket.git /www/wwwroot/sellpify
#   bash /www/wwwroot/sellpify/scripts/server/setup.sh
#
# Installs Node.js + PM2 if missing, asks once for the MongoDB connection string
# (every other setting is generated), builds and starts the site as PM2 app
# `sellpify` on 127.0.0.1:4810, and puts nginx in front for
# sellpify.com (Cloudflare connects to it on port 443). Other sites on this
# server (guestposting.live, rankkw.*, anything on port 80) are left untouched.
set -euo pipefail

main() {

APP=sellpify
DOMAIN=${DOMAIN:-sellpify.com}
PORT=4810
APP_DIR="$(cd "$(dirname "$0")/../.." && pwd)"

say()  { printf '\n\033[1;32m==> %s\033[0m\n' "$*"; }
warn() { printf '\n\033[1;33m!!  %s\033[0m\n' "$*"; }
die()  { printf '\n\033[1;31mXX  %s\033[0m\n' "$*"; exit 1; }

[ "$(id -u)" = 0 ] || die "Please run this as root."
cd "$APP_DIR"
[ -f package.json ] && grep -q '"name": "sellpify"' package.json || die "Run this from the Sellpify code folder (got $APP_DIR)."

if command -v apt-get >/dev/null 2>&1; then PKG=apt
elif command -v dnf >/dev/null 2>&1; then PKG=dnf
elif command -v yum >/dev/null 2>&1; then PKG=yum
else die "Unsupported system (no apt, dnf or yum)."; fi
pkg_install() {
  if [ "$PKG" = apt ]; then DEBIAN_FRONTEND=noninteractive apt-get install -y "$@"; else "$PKG" install -y "$@"; fi
}

# ---------------------------------------------------------------- 1. tools
say "1/6 Tools"
[ "$PKG" = apt ] && apt-get update -y >/dev/null
pkg_install git curl openssl ca-certificates >/dev/null
node_ok() {
  command -v node >/dev/null 2>&1 &&
    node -e 'const [a,b]=process.versions.node.split(".").map(Number);process.exit(a>20||(a===20&&b>=9)?0:1)'
}
if node_ok; then
  echo "Node.js $(node -v) already installed"
else
  say "Installing Node.js 22"
  if [ "$PKG" = apt ]; then curl -fsSL https://deb.nodesource.com/setup_22.x | bash - >/dev/null
  else curl -fsSL https://rpm.nodesource.com/setup_22.x | bash - >/dev/null; fi
  pkg_install nodejs >/dev/null
  hash -r
  node_ok || die "Node.js 20.9+ is required but $(node -v 2>/dev/null || echo 'none') is active."
fi
command -v pm2 >/dev/null 2>&1 || { say "Installing PM2"; npm install -g pm2 >/dev/null; }

# ---------------------------------------------------------------- 2. settings
say "2/6 Settings (.env.local)"
if [ -f .env.local ]; then
  echo "Keeping the existing $APP_DIR/.env.local (site URL set to https://$DOMAIN)"
  # The site URL and name are inlined at build time, so point an older file at this domain.
  sed -i "s|^NEXT_PUBLIC_SITE_URL=.*|NEXT_PUBLIC_SITE_URL=https://$DOMAIN|; s|^NEXT_PUBLIC_SITE_NAME=.*|NEXT_PUBLIC_SITE_NAME=Sellpify|" .env.local
  grep -q '^NEXT_PUBLIC_SUPPORT_EMAIL=' .env.local || echo "NEXT_PUBLIC_SUPPORT_EMAIL=support@$DOMAIN" >> .env.local
else
  echo "Paste the MongoDB connection string (mongodb+srv://...) and press Enter:"
  read -r MONGO </dev/tty
  MONGO=$(printf '%s' "$MONGO" | tr -d '\r' | sed 's/^ *//; s/ *$//')
  case "$MONGO" in mongodb://*|mongodb+srv://*) ;; *) die "That is not a MongoDB connection string. Run this again." ;; esac
  umask 077
  cat > .env.local <<EOF
# $DOMAIN production settings (written by scripts/server/setup.sh).
MONGODB_URI=$MONGO
NEXT_PUBLIC_SITE_URL=https://$DOMAIN
NEXT_PUBLIC_SITE_NAME=Sellpify
NEXT_PUBLIC_SUPPORT_EMAIL=support@$DOMAIN
# Signs logins and download links. Changing it logs everyone out.
AUTH_SECRET=$(openssl rand -hex 48)
# Bearer token for the admin API.
ADMIN_API_KEY=$(openssl rand -hex 32)
# Never true in production: it completes paid orders without a payment.
DEMO_CHECKOUT=false
NEXT_PUBLIC_TAX_RATE=0
NEXT_PUBLIC_SERVICE_FEE_CENTS=0
NEXT_PUBLIC_COMMISSION_RATE=0
EOF
  chmod 600 .env.local
  echo "Saved $APP_DIR/.env.local (login and admin secrets generated)"
fi
grep -q '^DEMO_CHECKOUT=true' .env.local && warn "DEMO_CHECKOUT=true: paid orders complete WITHOUT payment. Set it to false in .env.local."

# The build reads products from the database, so check it before building.
say "Checking the database connection"
[ -d node_modules/mongoose ] || npm ci --no-audit --no-fund >/dev/null
if ! node --env-file=.env.local -e "
  import('mongoose').then(async ({ default: m }) => {
    await m.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
    await m.connection.db.command({ ping: 1 }); await m.disconnect();
  }).catch((e) => { console.error(e.message); process.exit(1); });"; then
  die "Cannot reach the database. In MongoDB Atlas > Network Access add this server's IP ($(curl -s --max-time 5 https://api.ipify.org || echo 'this server')), check the user/password in $APP_DIR/.env.local, then run this again."
fi
echo "OK   database reachable"

# ---------------------------------------------------------------- 3. build + run
say "3/6 Building and starting (a few minutes)"
if ss -ltnH "sport = :$PORT" 2>/dev/null | grep -q . && ! pm2 describe "$APP" >/dev/null 2>&1; then
  die "Port $PORT is already used by another program."
fi
bash scripts/deploy.sh
pm2 startup systemd -u root --hp /root >/dev/null 2>&1 || warn "Could not enable PM2 start-on-boot (run: pm2 startup)."
pm2 save >/dev/null

# ---------------------------------------------------------------- 4. nginx
say "4/6 nginx for $DOMAIN"
OWNER80=$(ss -ltnpH 'sport = :80' 2>/dev/null | grep -o '(("[^"]*"' | head -1 | tr -d '("' || true)
HTTPS_ONLY=0
if [ -n "$OWNER80" ] && [ "$OWNER80" != nginx ]; then
  HTTPS_ONLY=1
  echo "Port 80 belongs to $OWNER80 (left untouched); nginx serves $DOMAIN on port 443"
fi
if [ -x /www/server/nginx/sbin/nginx ]; then
  NGINX=/www/server/nginx/sbin/nginx; CONF_DIR=/www/server/panel/vhost/nginx; SYSTEM_NGINX=0
  echo "Using aaPanel's nginx"
else
  SYSTEM_NGINX=1; CONF_DIR=/etc/nginx/conf.d
  command -v nginx >/dev/null 2>&1 || die "nginx is not installed (the rankkw setup installs it; run that first)."
  NGINX=$(command -v nginx)
fi
mkdir -p "$CONF_DIR"

# Certificate for the Cloudflare -> server hop (Cloudflare SSL/TLS mode "Full").
CERT_DIR=/etc/ssl/$APP
if [ ! -s "$CERT_DIR/fullchain.pem" ]; then
  mkdir -p "$CERT_DIR"
  openssl req -x509 -nodes -newkey rsa:2048 -days 3650 \
    -subj "/CN=$DOMAIN" -addext "subjectAltName=DNS:$DOMAIN,DNS:www.$DOMAIN" \
    -keyout "$CERT_DIR/privkey.pem" -out "$CERT_DIR/fullchain.pem" >/dev/null 2>&1
  chmod 600 "$CERT_DIR/privkey.pem"
fi
if [ "$HTTPS_ONLY" = 1 ]; then LISTEN="listen 443 ssl;"; else LISTEN="listen 80;
    listen 443 ssl;"; fi

cat > "$CONF_DIR/$DOMAIN.conf" <<EOF
# $DOMAIN -> Next.js on 127.0.0.1:$PORT (written by scripts/server/setup.sh)
server {
    $LISTEN
    server_name www.$DOMAIN;
    ssl_certificate     $CERT_DIR/fullchain.pem;
    ssl_certificate_key $CERT_DIR/privkey.pem;
    return 301 https://$DOMAIN\$request_uri;
}

server {
    $LISTEN
    server_name $DOMAIN;
    ssl_certificate     $CERT_DIR/fullchain.pem;
    ssl_certificate_key $CERT_DIR/privkey.pem;

    client_max_body_size 10m;

    location / {
        proxy_pass http://127.0.0.1:$PORT;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header CF-Connecting-IP \$http_cf_connecting_ip;
        proxy_read_timeout 300s;
    }
}
EOF
if ! "$NGINX" -t; then
  rm -f "$CONF_DIR/$DOMAIN.conf"
  die "nginx rejected the config, so it was removed again (other sites unaffected)."
fi
if [ "$SYSTEM_NGINX" = 1 ]; then
  systemctl reload nginx 2>/dev/null || systemctl restart nginx || die "nginx did not start. See: journalctl -u nginx -n 30"
else
  "$NGINX" -s reload 2>/dev/null || "$NGINX"
fi

# ---------------------------------------------------------------- 5. checks
say "5/6 Checking"
problems=0
code=$(curl -sk -o /dev/null -w '%{http_code}' --resolve "$DOMAIN:443:127.0.0.1" "https://$DOMAIN/" || true)
if [ "$code" = 200 ]; then echo "OK   $DOMAIN answers through nginx on port 443"; else warn "HTTPS returned $code"; problems=1; fi
if curl -s -m 30 "http://127.0.0.1:$PORT/api/health" | grep -q '"status":"ok"'; then
  echo "OK   database connected"
else
  warn "Health check failed. See: pm2 logs $APP"
  problems=1
fi

# ---------------------------------------------------------------- 7. done
say "6/6 Done"
if [ "$problems" = 0 ]; then
  echo "$DOMAIN is running. In Cloudflare: A record @ -> this server (orange cloud), CNAME www -> $DOMAIN, SSL/TLS mode Full."
else
  warn "Setup finished with the problems above."
fi
echo
echo "Create your admin login (prints a password once):"
echo "  cd $APP_DIR && npm run create-admin -- --email you@example.com --name \"Your Name\""
echo "Future updates:  bash $APP_DIR/scripts/deploy.sh"
echo "Logs:            pm2 logs $APP"
}

main "$@"
