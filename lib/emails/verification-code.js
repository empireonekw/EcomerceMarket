import { siteConfig } from '@/lib/site';

// The "verify your email" code email: Sellpify's cream, ink and gold, the logo on top and the code in a big box.
// Tables and inline styles only, so it looks the same in Gmail, Outlook and Apple Mail. The logo is the inline
// attachment lib/mailer.js adds to every email (cid:sellpify-logo).

const escape = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const INK = '#141414';
const MUTED = '#6b6660';
const GOLD = '#edae49';
const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const SERIF = "Georgia,'Times New Roman',serif";

/** { subject, html, text } for the 6-digit `code`, valid for `minutes`. */
export function verificationCodeEmail({ name, code, minutes }) {
  const firstName = escape(String(name ?? '').split(' ')[0] || 'there');
  const site = siteConfig.url.replace(/\/$/, '');
  const support = escape(siteConfig.supportEmail);
  const year = new Date().getFullYear();
  const digits = String(code)
    .split('')
    .map(
      (d) =>
        `<td style="width:44px;height:56px;background:#ffffff;border:1px solid #f1c35a;border-radius:10px;text-align:center;font-family:${FONT};font-size:30px;font-weight:700;color:${INK};">${d}</td><td style="width:8px;"></td>`,
    )
    .join('');

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light only">
<title>Verify your email</title>
</head>
<body style="margin:0;padding:0;background:#f6f3ec;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">Your ${escape(siteConfig.name)} code is ${code}. It expires in ${minutes} minutes.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f6f3ec;">
<tr><td align="center" style="padding:32px 12px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;">
    <tr><td align="center" style="padding:0 0 24px;">
      <a href="${site}" target="_blank"><img src="cid:sellpify-logo" width="150" alt="${escape(siteConfig.name)}" style="display:block;width:150px;height:auto;border:0;"></a>
    </td></tr>
    <tr><td style="background:#ffffff;border-radius:18px;border-top:4px solid ${GOLD};padding:36px 32px 32px;">
      <h1 style="margin:0 0 16px;font-family:${SERIF};font-size:28px;line-height:34px;font-weight:normal;color:${INK};">Verify your email</h1>
      <p style="margin:0 0 12px;font-family:${FONT};font-size:16px;line-height:24px;color:${INK};">Hi ${firstName},</p>
      <p style="margin:0 0 24px;font-family:${FONT};font-size:16px;line-height:24px;color:#3d3a36;">Enter this code on ${escape(siteConfig.name)} to confirm this is your email address:</p>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto;"><tr>${digits}</tr></table>
      <p style="margin:20px 0 0;text-align:center;font-family:${FONT};font-size:14px;line-height:20px;color:${MUTED};">This code expires in <strong style="color:${INK};">${minutes} minutes</strong>.</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0 0;"><tr>
        <td style="background:#fdf8ec;border-radius:12px;padding:16px 18px;font-family:${FONT};font-size:14px;line-height:21px;color:#3d3a36;">
          Once your email is verified you can <strong style="color:${INK};">shop</strong> and <strong style="color:${INK};">open your own shop</strong> on ${escape(siteConfig.name)}.
        </td>
      </tr></table>
      <p style="margin:24px 0 0;font-family:${FONT};font-size:13px;line-height:20px;color:${MUTED};">Didn’t ask for this code? You can ignore this email, your account stays safe. Never share this code with anyone: ${escape(siteConfig.name)} will never ask you for it.</p>
    </td></tr>
    <tr><td align="center" style="padding:24px 16px 0;font-family:${FONT};font-size:13px;line-height:20px;color:${MUTED};">
      <a href="${site}/products" target="_blank" style="color:${INK};text-decoration:none;font-weight:600;">Shop</a>
      &nbsp;·&nbsp;
      <a href="${site}/sell-on-sellpify" target="_blank" style="color:${INK};text-decoration:none;font-weight:600;">Sell on ${escape(siteConfig.name)}</a>
      &nbsp;·&nbsp;
      <a href="${site}/help" target="_blank" style="color:${INK};text-decoration:none;font-weight:600;">Help</a>
      <br>Questions? Write to <a href="mailto:${support}" style="color:${INK};">${support}</a>
      <br>&copy; ${year} ${escape(siteConfig.name)}. All rights reserved.
    </td></tr>
  </table>
</td></tr>
</table>
</body>
</html>`;

  const text = `Hi ${String(name ?? '').split(' ')[0] || 'there'},

Your ${siteConfig.name} verification code is: ${code}

It expires in ${minutes} minutes. Once your email is verified you can shop and open your own shop on ${siteConfig.name}.

Didn't ask for this code? You can ignore this email. Never share this code with anyone.

${siteConfig.name} · ${site}`;

  return { subject: `${code} is your ${siteConfig.name} verification code`, html, text };
}
