import { siteConfig } from './site.js';

/**
 * Dark "case update" style email (big heading, short text, one button, help card).
 * Built with tables + inline styles so it renders in Gmail, Outlook and Apple Mail.
 *
 * `body` and `footer` are raw HTML; `title`, `buttonText` and `preheader` are plain text.
 *
 *   await transporter.sendMail({ to, subject, html: renderEmail({ title, body, buttonText, buttonUrl }) });
 */
export function renderEmail({
  preheader = '',
  title = 'Your heading here',
  body = '<p style="margin:0 0 16px;">Your text here.</p>',
  buttonText = '',
  buttonUrl = siteConfig.url,
  footer = `Need help? Reply to this email or contact <a href="mailto:${siteConfig.supportEmail}" style="color:#f5c542;text-decoration:none;">${siteConfig.supportEmail}</a>.`,
} = {}) {
  const year = new Date().getFullYear();

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="dark">
  <meta name="supported-color-schemes" content="dark">
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background-color:#121212;">
  <!-- Preview text shown in the inbox list, hidden in the email itself -->
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${preheader}</div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#121212" style="background-color:#121212;">
    <tr>
      <td align="center" style="padding:24px 12px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">

          <!-- View in browser -->
          <tr>
            <td align="center" style="padding:0 0 20px;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#8a8a8a;">
              <a href="${siteConfig.url}" style="color:#8a8a8a;text-decoration:none;">View in browser</a>
            </td>
          </tr>

          <!-- Logo: white box. Swap the text for <img src="https://.../logo.png" width="140" alt="${siteConfig.name}" style="display:block;border:0;"> -->
          <tr>
            <td align="center" style="padding:0 0 32px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td bgcolor="#ffffff" style="background-color:#ffffff;padding:18px 28px;font-family:Arial,Helvetica,sans-serif;font-size:30px;font-weight:700;letter-spacing:-0.5px;color:#1c1f3a;">
                    ${siteConfig.name.toLowerCase()}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Heading -->
          <tr>
            <td style="padding:0 28px 20px;font-family:Arial,Helvetica,sans-serif;font-size:40px;line-height:46px;font-weight:700;color:#ffffff;">
              ${title}
            </td>
          </tr>

          <!-- Body text -->
          <tr>
            <td style="padding:0 28px 12px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:25px;color:#e6e6e6;">
              ${body}
            </td>
          </tr>

          ${buttonText ? `<!-- Button -->
          <tr>
            <td style="padding:12px 28px 40px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td bgcolor="#4a3700" style="background-color:#4a3700;border-radius:3px;">
                    <a href="${buttonUrl}" target="_blank" style="display:inline-block;padding:15px 28px;font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:700;color:#ffffff;text-decoration:none;">${buttonText}</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>` : ''}

          <!-- Help card -->
          <tr>
            <td style="padding:8px 28px 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#1f1f1f" style="background-color:#1f1f1f;border-radius:8px;">
                <tr>
                  <td style="padding:24px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#bdbdbd;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td width="22" height="22" align="center" valign="middle" style="border:2px solid #ffffff;border-radius:50%;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:700;color:#ffffff;">?</td>
                      </tr>
                    </table>
                    <div style="padding-top:14px;">${footer}</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Legal -->
          <tr>
            <td align="center" style="padding:0 28px;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:18px;color:#6f6f6f;">
              &copy; ${year} ${siteConfig.name}. All rights reserved.
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
