#!/usr/bin/env bash
# Turns this server's MongoDB (installed by mongo-local.sh) into a one-member replica set, so MongoDB transactions work.
# Orders, seller payouts and admin user deletion save several records together in a transaction; a standalone MongoDB
# refuses them ("Transaction numbers are only allowed on a replica set member"). Run as root. Safe to re-run.
#
#   cd /www/wwwroot/sellpify && git pull && bash scripts/server/mongo-replset.sh
#
# 1. Takes a backup first (/root/mongo-backup/before-replset-*.gz).
# 2. Adds a replica set name and an internal key file to /etc/mongod.conf (the key file is required when logins are
#    on), restarts MongoDB and starts the set. It still listens on 127.0.0.1 only, logins unchanged.
# 3. Checks that a transaction works with the site's own login, restarts the site and checks it is healthy.
# If MongoDB doesn't come back or the check fails, the old config is restored and MongoDB restarted as before.
set -euo pipefail

main() {

APP=sellpify
PORT=${PORT:-4810}
APP_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
ENV_FILE="$APP_DIR/.env.local"
CREDS=/root/.mongodb-sellpify
CONF=/etc/mongod.conf
KEYFILE=/etc/mongod-keyfile
SET=rs0
MARK='written by scripts/server/mongo-local.sh'

say()  { printf '\n\033[1;32m==> %s\033[0m\n' "$*"; }
warn() { printf '\n\033[1;33m!!  %s\033[0m\n' "$*"; }
die()  { printf '\n\033[1;31mXX  %s\033[0m\n' "$*"; exit 1; }

[ "$(id -u)" = 0 ] || die "Please run this as root."
[ -f "$CREDS" ] || die "$CREDS not found: this MongoDB wasn't set up by scripts/server/mongo-local.sh."
grep -q "$MARK" "$CONF" 2>/dev/null || die "$CONF wasn't written by mongo-local.sh. Not touching it."
. "$CREDS"
ADMIN_URI="mongodb://admin:$ADMIN_PW@127.0.0.1:27017/?authSource=admin&directConnection=true"
APP_URI=$(grep -m1 '^MONGODB_URI=' "$ENV_FILE" | cut -d= -f2- | tr -d '\r')
DB=$(printf '%s' "$APP_URI" | sed -E 's#^mongodb(\+srv)?://[^/]+/?([^?]*).*#\2#')
case "$APP_URI" in *127.0.0.1:27017*) ;; *) die "MONGODB_URI in $ENV_FILE doesn't point at this server's MongoDB." ;; esac

ping_ok() { mongosh --quiet "mongodb://127.0.0.1:27017/admin?directConnection=true" --eval 'db.runCommand({ ping: 1 }).ok' 2>/dev/null | grep -q 1; }
is_primary() { mongosh --quiet "$ADMIN_URI" --eval 'db.hello().isWritablePrimary' 2>/dev/null | grep -q true; }
txn_ok() {
  U="$APP_URI" D="$DB" mongosh --quiet --nodb --eval '
    const c = new Mongo(process.env.U + (process.env.U.includes("?") ? "&" : "?") + "directConnection=true");
    const s = c.startSession(); s.startTransaction();
    s.getDatabase(process.env.D).getCollection("orders").findOne();
    s.commitTransaction(); print("TXN_OK");' 2>&1 | grep -q TXN_OK
}

# --------------------------------------------------------------- already done?
if txn_ok; then
  say "Already done"
  echo "MongoDB is a replica set and transactions work. Nothing to change."
  return 0
fi

# --------------------------------------------------------------- 1. backup
say "1/3 Backup"
mkdir -p /root/mongo-backup
BK="/root/mongo-backup/before-replset-$(date +%Y%m%d-%H%M%S).gz"
umask 077
TMPC=$(mktemp); trap 'rm -f "$TMPC"' EXIT
printf "uri: 'mongodb://admin:%s@127.0.0.1:27017/?authSource=admin&directConnection=true'\n" "$ADMIN_PW" > "$TMPC"
mongodump --config="$TMPC" --gzip --archive="$BK" --quiet || die "Backup failed. Nothing was changed."
echo "OK   $BK"

# --------------------------------------------------------------- 2. replica set
say "2/3 Replica set"
cp -p "$CONF" "$CONF.before-replset"
restore() {
  warn "$1 Restoring the previous MongoDB config."
  cp -p "$CONF.before-replset" "$CONF"
  systemctl restart mongod || true
  for i in $(seq 1 30); do ping_ok && break; sleep 1; done
  pm2 restart "$APP" --update-env >/dev/null 2>&1 || true
  die "Nothing else was changed. Backup: $BK. Details: journalctl -u mongod -n 30"
}

if [ ! -f "$KEYFILE" ]; then
  openssl rand -base64 756 > "$KEYFILE"
fi
chown mongodb:mongodb "$KEYFILE"
chmod 400 "$KEYFILE"
grep -q '^  keyFile:' "$CONF" || sed -i "s#^  authorization: enabled#  authorization: enabled\n  keyFile: $KEYFILE#" "$CONF"
grep -q '^replication:' "$CONF" || printf 'replication:\n  replSetName: %s\n' "$SET" >> "$CONF"

systemctl restart mongod
for i in $(seq 1 40); do ping_ok && break; sleep 1; done
ping_ok || restore "MongoDB did not start with the replica set settings."

if ! is_primary; then
  mongosh --quiet "$ADMIN_URI" --eval "
    try { rs.status(); } catch (e) { rs.initiate({ _id: '$SET', members: [{ _id: 0, host: '127.0.0.1:27017' }] }); }" >/dev/null 2>&1 || true
  for i in $(seq 1 30); do is_primary && break; sleep 1; done
fi
is_primary || restore "The replica set did not become ready."
echo "OK   MongoDB is replica set '$SET' (still 127.0.0.1 only, same logins)"

# --------------------------------------------------------------- 3. check
say "3/3 Checking"
txn_ok || restore "A test transaction with the site's login failed."
echo "OK   transactions work with the site's login"
cd "$APP_DIR"
pm2 restart "$APP" --update-env >/dev/null
healthy=0
for i in $(seq 1 18); do
  sleep 5
  if curl -s -m 10 "http://127.0.0.1:$PORT/api/health" | grep -q '"status":"ok"'; then healthy=1; break; fi
done
[ "$healthy" = 1 ] || restore "The site did not come up healthy."
echo "OK   site healthy"

say "Done"
echo "Orders, seller payouts and admin user deletion can save again."
echo "  Backup taken first:  $BK"
echo "  Old config:          $CONF.before-replset"
}

main "$@"
