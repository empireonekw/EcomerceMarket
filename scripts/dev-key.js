// `npm run dev:key`: creates this computer's own SSH key for the database tunnel that `npm run dev` opens (only if it
// doesn't exist yet) and prints the one command the server admin pastes on the server to allow it. The key can only
// reach MongoDB on the server: no shell, no commands. Each developer has their own key, so one can be removed alone.
import { execFileSync } from 'node:child_process';
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

console.log(`
Send the command below to the server admin. It contains only your PUBLIC key, so it is safe to send.
They paste it in the server terminal once; after that, npm run dev connects by itself.

mkdir -p /root/.ssh && echo '${options} ${pub}' >> /root/.ssh/authorized_keys && chmod 600 /root/.ssh/authorized_keys && echo OK
`);
