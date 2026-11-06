import 'server-only';
import path from 'node:path';
import nodemailer from 'nodemailer';
import { siteConfig } from '@/lib/site';

// Sends the site's emails through Gmail with Nodemailer. Set in the env file (never commit it):
//   EMAIL_USER=sellpifyofficial@gmail.com
//   EMAIL_APP_PASSWORD=<16-letter Google app password>
// Every email carries the logo as an inline attachment (cid:sellpify-logo), so it shows without a public image URL.

export const mailerEnabled = () => Boolean(process.env.EMAIL_USER && process.env.EMAIL_APP_PASSWORD);

let transporter;
function getTransporter() {
  transporter ??= nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_APP_PASSWORD.replace(/\s+/g, '') }, // Google shows it in 4 groups
  });
  return transporter;
}

const LOGO = { filename: 'sellpify-logo.png', path: path.join(process.cwd(), 'assets/brand/sellpify-logo-email.png'), cid: 'sellpify-logo' };

/** Sends one email ({ to, subject, html, text }) from "Sellpify <EMAIL_USER>". Throws when sending fails. */
export async function sendEmail({ to, subject, html, text }) {
  if (!mailerEnabled()) throw new Error('Email is not set up: add EMAIL_USER and EMAIL_APP_PASSWORD to the env file.');
  await getTransporter().sendMail({ from: { name: siteConfig.name, address: process.env.EMAIL_USER }, to, subject, html, text, attachments: [LOGO] });
}
