#!/usr/bin/env bash
# Moves sellpify.com's database from MongoDB Atlas to MongoDB on this server (run as root). Safe to re-run.
#
#   cd /www/wwwroot/sellpify && git pull && bash scripts/server/mongo-local.sh
#
# 1. Installs MongoDB 8.0: listens on 127.0.0.1 only (never reachable from the internet), login required,
#    memory cache capped so the other sites on this server keep theirs.
# 2. Creates an admin login and a login for this site. Passwords go to /root/.mongodb-sellpify (root only).
# 3. Copies the database from the Atlas address in .env.local (the copy stays in /root/mongo-backup/) and checks
#    that every collection has the same number of documents. Nothing is switched if they differ.
# 4. Points .env.local at the local database (the Atlas version is kept as .env.local.atlas), restarts the site
#    and checks it. If the site does not come up healthy, it switches back to Atlas by itself.
# 5. Adds a nightly backup of the local database (02:30, kept 14 days) in /root/mongo-backup/.
#
# Back to Atlas by hand:  cp .env.local.atlas .env.local && pm2 restart sellpify --update-env
set -euo pipefail

main() {

APP=sellpify
PORT=${PORT:-4810}
APP_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
ENV_FILE="$APP_DIR/.env.local"
CREDS=/root/.mongodb-sellpify
BACKUP_ROOT=/root/mongo-backup
MARK='written by scripts/server/mongo-local.sh'

say()  { printf '\n\033[1;32m==> %s\033[0m\n' "$*"; }
warn() { printf '\n\033[1;33m!!  %s\033[0m\n' "$*"; }
die()  { printf '\n\033[1;31mXX  %s\033[0m\n' "$*"; exit 1; }

[ "$(id -u)" = 0 ] || die "Please run this as root."
[ -f "$ENV_FILE" ] || die "$ENV_FILE not found. Run scripts/server/setup.sh first."
command -v apt-get >/dev/null 2>&1 || die "This script supports Ubuntu only."

umask 077
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

CUR_URI=$(grep -m1 '^MONGODB_URI=' "$ENV_FILE" | cut -d= -f2- | tr -d '\r')
[ -n "$CUR_URI" ] || die "MONGODB_URI is missing in $ENV_FILE."
case "$CUR_URI" in *@127.0.0.1:27017/*) ALREADY_LOCAL=1 ;; *) ALREADY_LOCAL=0 ;; esac
# Database name = the path of the URI (mongodb+srv://user:pw@host/<name>?options).
DB=$(printf '%s' "$CUR_URI" | sed -E 's#^mongodb(\+srv)?://[^/]+/?([^?]*).*#\2#')
[ -n "$DB" ] || die "MONGODB_URI has no database name (…mongodb.net/<name>?…). Add it and run this again."

# --------------------------------------------------------------- 1. install
say "1/5 MongoDB"
if command -v mongod >/dev/null 2>&1; then
  grep -q "$MARK" /etc/mongod.conf 2>/dev/null ||
    die "MongoDB is already installed here, but not by this script. Not touching it, so other programs keep working."
  echo "MongoDB $(mongod --version | head -1 | grep -o '[0-9.]*$') already installed"
else
  grep -qw avx /proc/cpuinfo || die "This server's CPU has no AVX support, which MongoDB 5.0 and newer require."
  . /etc/os-release
  [ "${ID:-}" = ubuntu ] || die "This script supports Ubuntu only (found ${ID:-unknown})."
  case "${VERSION_CODENAME:-}" in
    noble|jammy|focal) ;;
    *) die "MongoDB 8.0 supports Ubuntu 20.04, 22.04 and 24.04 (this is ${VERSION_ID:-unknown})." ;;
  esac
  echo "Installing MongoDB 8.0 for Ubuntu $VERSION_ID (a minute or two)"
  DEBIAN_FRONTEND=noninteractive apt-get install -y gnupg curl >/dev/null
  curl -fsSL https://www.mongodb.org/static/pgp/server-8.0.asc | gpg --dearmor --yes -o /usr/share/keyrings/mongodb-server-8.0.gpg
  chmod 644 /usr/share/keyrings/mongodb-server-8.0.gpg
  echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-8.0.gpg ] https://repo.mongodb.org/apt/ubuntu $VERSION_CODENAME/mongodb-org/8.0 multiverse" \
    > /etc/apt/sources.list.d/mongodb-org-8.0.list
  chmod 644 /etc/apt/sources.list.d/mongodb-org-8.0.list
  apt-get update -y >/dev/null
  DEBIAN_FRONTEND=noninteractive apt-get install -y mongodb-org >/dev/null

  # MongoDB takes half the RAM for its cache by default; the other sites need theirs.
  AVAIL_MB=$(awk '/^MemAvailable:/ {print int($2/1024)}' /proc/meminfo)
  CACHE_GB=1
  if [ "$AVAIL_MB" -lt 2500 ]; then CACHE_GB=0.5; warn "Only ${AVAIL_MB} MB RAM free: MongoDB cache set to 0.5 GB."; fi
  [ -f /etc/mongod.conf ] && cp /etc/mongod.conf /etc/mongod.conf.orig
  cat > /etc/mongod.conf <<EOF
# $MARK
storage:
  dbPath: /var/lib/mongodb
  wiredTiger:
    engineConfig:
      cacheSizeGB: $CACHE_GB
systemLog:
  destination: file
  logAppend: true
  path: /var/log/mongodb/mongod.log
net:
  port: 27017
  bindIp: 127.0.0.1
processManagement:
  timeZoneInfo: /usr/share/zoneinfo
security:
  authorization: enabled
EOF
  chmod 644 /etc/mongod.conf
fi
systemctl enable mongod >/dev/null 2>&1
systemctl start mongod
up=0
for i in $(seq 1 30); do
  if mongosh --quiet --eval 'db.runCommand({ ping: 1 }).ok' mongodb://127.0.0.1:27017/admin 2>/dev/null | grep -q 1; then up=1; break; fi
  sleep 1
done
[ "$up" = 1 ] || die "MongoDB did not start. See: journalctl -u mongod -n 30 and /var/log/mongodb/mongod.log"
echo "OK   MongoDB running on 127.0.0.1:27017 (not reachable from outside)"

# --------------------------------------------------------------- 2. logins
say "2/5 Logins"
if [ ! -f "$CREDS" ]; then
  printf '# MongoDB passwords (%s)\nADMIN_PW=%s\nAPP_PW=%s\n' "$MARK" "$(openssl rand -hex 24)" "$(openssl rand -hex 24)" > "$CREDS"
  . "$CREDS"
  # The first user can be created without a login, from this machine only.
  if ! ADMIN_PW="$ADMIN_PW" mongosh --quiet mongodb://127.0.0.1:27017/admin --eval \
      'db.createUser({ user: "admin", pwd: process.env.ADMIN_PW, roles: ["root"] })' >/dev/null; then
    rm -f "$CREDS"
    die "Could not create the MongoDB admin login (MongoDB already has logins that this script did not make)."
  fi
  echo "Created MongoDB logins 'admin' and '$APP' (passwords in $CREDS)"
fi
. "$CREDS"
ADMIN_PW="$ADMIN_PW" APP_PW="$APP_PW" DB="$DB" APP="$APP" mongosh --quiet mongodb://127.0.0.1:27017/admin --eval '
  db.auth("admin", process.env.ADMIN_PW);
  const d = db.getSiblingDB(process.env.DB);
  const roles = [{ role: "readWrite", db: process.env.DB }, { role: "dbAdmin", db: process.env.DB }];
  if (d.getUser(process.env.APP)) d.updateUser(process.env.APP, { pwd: process.env.APP_PW, roles });
  else d.createUser({ user: process.env.APP, pwd: process.env.APP_PW, roles });' >/dev/null
LOCAL_URI="mongodb://$APP:$APP_PW@127.0.0.1:27017/$DB?authSource=$DB"
ADMIN_URI="mongodb://admin:$ADMIN_PW@127.0.0.1:27017/?authSource=admin"
echo "OK   '$APP' can read and write database '$DB'"

# --------------------------------------------------------------- 5 (first, so it exists even if the copy fails). nightly backup
cat > /root/mongo-backup.sh <<'EOF'
#!/usr/bin/env bash
# Nightly dump of the local MongoDB, kept 14 days (written by scripts/server/mongo-local.sh).
# Restore one:  mongorestore --uri="mongodb://admin:<ADMIN_PW from /root/.mongodb-sellpify>@127.0.0.1:27017/?authSource=admin" --gzip --archive=<file> --drop
set -euo pipefail
umask 077
. /root/.mongodb-sellpify
CONF=$(mktemp); trap 'rm -f "$CONF"' EXIT
printf "uri: 'mongodb://admin:%s@127.0.0.1:27017/?authSource=admin'\n" "$ADMIN_PW" > "$CONF"
mkdir -p /root/mongo-backup
mongodump --config="$CONF" --gzip --archive="/root/mongo-backup/nightly-$(date +%F).gz" --quiet
find /root/mongo-backup -name 'nightly-*.gz' -mtime +14 -delete
EOF
chmod 700 /root/mongo-backup.sh
printf '# %s\n30 2 * * * root /root/mongo-backup.sh >> /var/log/mongo-backup.log 2>&1\n' "$MARK" > /etc/cron.d/mongo-backup
chmod 644 /etc/cron.d/mongo-backup

if [ "$ALREADY_LOCAL" = 1 ]; then
  say "Done"
  echo "The site already uses the local database. Nightly backups: /root/mongo-backup/ (02:30)."
  return 0
fi

# --------------------------------------------------------------- 3. copy
say "3/5 Copying '$DB' from Atlas"
OUT="$BACKUP_ROOT/atlas-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$OUT"
printf "uri: '%s'\n" "$CUR_URI" > "$TMP/src.yaml"
printf "uri: '%s'\n" "$ADMIN_URI" > "$TMP/dst.yaml"
mongodump --config="$TMP/src.yaml" --out="$OUT" --quiet || die "Could not read from Atlas. Nothing was changed."
mongorestore --config="$TMP/dst.yaml" --dir="$OUT" --nsInclude="$DB.*" --drop --quiet || die "Could not write the copy. Nothing was switched."

COUNT_JS='const d = connect(process.env.U);
  print(d.getCollectionNames().filter((c) => !c.startsWith("system.")).sort()
    .map((c) => c + "=" + d.getCollection(c).countDocuments()).join("\n"));'
U="$CUR_URI" mongosh --quiet --nodb --eval "$COUNT_JS" > "$TMP/atlas.txt"
U="$LOCAL_URI" mongosh --quiet --nodb --eval "$COUNT_JS" > "$TMP/local.txt"
if ! diff -q "$TMP/atlas.txt" "$TMP/local.txt" >/dev/null; then
  diff "$TMP/atlas.txt" "$TMP/local.txt" || true
  die "The copy does not match Atlas (above: Atlas < > local). Nothing was switched. Run this again."
fi
sed 's/^/     /' "$TMP/local.txt"
echo "OK   all $(wc -l < "$TMP/local.txt") collections copied, same document counts as Atlas"

# --------------------------------------------------------------- 4. switch
say "4/5 Switching the site to the local database"
cp -p "$ENV_FILE" "$ENV_FILE.atlas"
awk -v u="$LOCAL_URI" '/^MONGODB_URI=/ && !done { print "MONGODB_URI=" u; done = 1; next } { print }' "$ENV_FILE" > "$TMP/env"
cat "$TMP/env" > "$ENV_FILE"
cd "$APP_DIR"
pm2 restart "$APP" --update-env >/dev/null

healthy=0
for i in $(seq 1 18); do
  sleep 5
  if curl -s -m 10 "http://127.0.0.1:$PORT/api/health" | grep -q '"status":"ok"'; then healthy=1; break; fi
done
# Atlas also uses port 27017, so count only connections to this machine.
connected=$(ss -tnH state established '( dst 127.0.0.1:27017 )' 2>/dev/null | wc -l)
if [ "$healthy" != 1 ] || [ "$connected" = 0 ]; then
  cat "$ENV_FILE.atlas" > "$ENV_FILE"
  pm2 restart "$APP" --update-env >/dev/null
  pm2 logs "$APP" --err --lines 15 --nostream 2>/dev/null | tail -15 || true
  die "The site did not come up on the local database, so it was switched back to Atlas (still running)."
fi
echo "OK   site healthy on the local database ($connected open connections)"

say "5/5 Done"
echo "sellpify.com now uses MongoDB on this server (database '$DB')."
echo "  Atlas copy taken just now:  $OUT"
echo "  Nightly backups:            /root/mongo-backup/nightly-*.gz (02:30, 14 days)"
echo "  Passwords:                  $CREDS"
echo "  Back to Atlas:              cp $ENV_FILE.atlas $ENV_FILE && pm2 restart $APP --update-env"
echo "Keep the Atlas database for a few days before deleting it."
}

main "$@"
