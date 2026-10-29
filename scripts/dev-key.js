// `npm run dev:key`: creates this computer's own SSH key for the database tunnel that `npm run dev` opens (only if it
// doesn't exist yet) and prints the one command the server admin pastes on the server to allow it. The key can only
// reach MongoDB on the server: no shell, no commands. Each developer has their own key, so one can be removed alone.
//
// `npm run dev:key -- --install`: if you have the server password yourself, installs the key on the server directly
// (asks for the password once, then checks the key works). No admin needed.
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const key = path.join(os.homedir(), '.ssh', 'sellpify_dev_tunnel');

if (existsSync(key)) {
  console.log(`Using your existing key ${key}`);
} else {
  mkdirSync(path.dirname(key), { recursive: true });
  const label = `sellpify-dev-${os.userInfo().username}@${os.hostname()}`.replace(/\s+/g, '-');
  execFileSync('ssh-keygen', ['-q', '-t', 'ed25519', '-N', '', '-C', label, '-f', key], { stdio: 'inherit' });
  console.log(`Created your key ${key} (keep it private, never send this file)`);
}

const pub = readFileSync(`${key}.pub`, 'utf8').trim();
const options = 'restrict,port-forwarding,permitopen="127.0.0.1:27017",command="grep ^MONGODB_URI /www/wwwroot/sellpify/.env.local"';
const keyBody = pub.split(/\s+/)[1];
// Safe to run twice: the key is only added if it isn't there yet.
const serverCommand =
  `mkdir -p /root/.ssh && touch /root/.ssh/authorized_keys && ` +
  `(grep -qF '${keyBody}' /root/.ssh/authorized_keys || echo '${options} ${pub}' >> /root/.ssh/authorized_keys) && ` +
  `chmod 700 /root/.ssh && chmod 600 /root/.ssh/authorized_keys && echo OK`;

if (!process.argv.includes('--install')) {
  console.log(`
Send the command below to the server admin. It contains only your PUBLIC key, so it is safe to send.
They paste it in the server terminal once; after that, npm run dev connects by itself.
Have the server password yourself? Run  npm run dev:key -- --install  instead.

${serverCommand}
`);
  process.exit(0);
}

const devEnv = existsSync('.env.development.local') ? readFileSync('.env.development.local', 'utf8') : '';
const target = devEnv.match(/^\s*DEV_DB_TUNNEL\s*=\s*['"]?([^'"\s]+)/m)?.[1] || 'root@13.140.168.178';

console.log(`\nInstalling your key on ${target}. Enter the server's password when ssh asks for it (it is not shown or saved).\n`);
const install = spawnSync(
  'ssh',
  ['-o', 'StrictHostKeyChecking=accept-new', '-o', 'PreferredAuthentications=password,keyboard-interactive', '-o', 'NumberOfPasswordPrompts=3', target, serverCommand],
  { stdio: 'inherit' },
);
if (install.status !== 0) {
  console.error('\nCould not install the key (wrong password, or password login is off on the server).');
  console.error('Send this command to the server admin instead, or paste it in the aaPanel / AWS web terminal:\n');
  console.error(`${serverCommand}\n`);
  process.exit(1);
}

// The key's forced command just prints a line; we only care that the key is accepted.
const check = spawnSync('ssh', ['-i', key, '-o', 'IdentitiesOnly=yes', '-o', 'BatchMode=yes', target], { stdio: 'ignore' });
console.log(check.status === 0
  ? '\nDone: the server accepts your key. Run  npm run dev  (restart it if it is already running).'
  : '\nThe key was added, but the server still refuses it. Check /root/.ssh/authorized_keys on the server.');
process.exit(check.status === 0 ? 0 : 1);
