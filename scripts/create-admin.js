// Creates an admin user, or promotes an existing user to admin and resets their password.
//
//   npm run create-admin -- --email you@example.com [--name "Your Name"] [--password "..."]
//
// Without --password a strong random password is generated and printed ONCE. Change it after first login
// by re-running this script with --password.
import { randomBytes } from 'node:crypto';
import { parseArgs } from 'node:util';
import mongoose from 'mongoose';
import { connectDB } from '../lib/mongodb.js';
import User from '../models/User.js';

const { values } = parseArgs({
  options: {
    email: { type: 'string' },
    name: { type: 'string' },
    password: { type: 'string' },
  },
});

const email = (values.email ?? process.env.ADMIN_EMAIL)?.trim().toLowerCase();
if (!email) {
  console.error('Usage: npm run create-admin -- --email you@example.com [--name "Name"] [--password "..."]');
  process.exit(1);
}

const generated = !(values.password ?? process.env.ADMIN_PASSWORD);
const password = values.password ?? process.env.ADMIN_PASSWORD ?? randomBytes(18).toString('base64url');
if (password.length < 12) {
  console.error('Admin passwords must be at least 12 characters.');
  process.exit(1);
}

await connectDB();

let user = await User.findOne({ email }).select('+password');
const existed = Boolean(user);
if (!user) user = new User({ email, name: values.name ?? email.split('@')[0] });
if (values.name) user.name = values.name;
user.role = 'admin';
user.password = password; // hashed by the pre('save') hook
await user.save();

console.log(`✓ ${existed ? 'Updated' : 'Created'} admin: ${email}`);
if (generated) console.log(`  Generated password (shown once): ${password}`);
console.log('  Sign in at /login');

await mongoose.disconnect();
