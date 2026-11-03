import 'server-only';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { siteConfig } from '@/lib/site';

// "Continue with Google": OAuth 2.0 authorization-code flow with PKCE, no extra packages. Needs GOOGLE_CLIENT_ID and
// GOOGLE_CLIENT_SECRET (.env.local) and <site URL>/api/auth/google/callback as an authorized redirect URI on the client.

export const googleSignInEnabled = () => Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

/** Short-lived cookie holding state + PKCE verifier + where to go afterwards, between the redirect and the callback. */
export const GOOGLE_FLOW_COOKIE = 'g_oauth';

/**
 * The public address of the site: NEXT_PUBLIC_SITE_URL in production, the address you opened locally in dev. Behind a
 * proxy (nginx → localhost:4810) request.url is the internal address, so never build user-facing redirects from it.
 */
export function siteOrigin(requestUrl) {
  return process.env.NODE_ENV === 'production' ? siteConfig.url.replace(/\/$/, '') : new URL(requestUrl).origin;
}

/** The callback URL Google sends the user back to. */
export const googleRedirectUri = (requestUrl) => `${siteOrigin(requestUrl)}/api/auth/google/callback`;

/** Google's consent-screen URL plus the values to remember in GOOGLE_FLOW_COOKIE. */
export function googleAuthRequest(redirectUri) {
  const state = randomBytes(24).toString('base64url');
  const verifier = randomBytes(48).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.search = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    prompt: 'select_account',
  }).toString();
  return { url: url.toString(), state, verifier };
}

export function sameState(a, b) {
  const x = Buffer.from(String(a ?? ''));
  const y = Buffer.from(String(b ?? ''));
  return x.length > 0 && x.length === y.length && timingSafeEqual(x, y);
}

/**
 * Exchanges the code for the user's Google identity: { sub, email, name }. The ID token comes straight from Google's
 * token endpoint over TLS, authenticated with our client secret, so its claims are checked rather than its signature
 * (OpenID Connect Core §3.1.3.7). Throws on anything unexpected; only verified Google emails are accepted.
 */
export async function googleIdentity({ code, verifier, redirectUri }) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      code_verifier: verifier,
      redirect_uri: redirectUri,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.id_token) throw new Error(`Google token exchange failed: ${data.error ?? res.status}`);

  const claims = JSON.parse(Buffer.from(data.id_token.split('.')[1] ?? '', 'base64url').toString('utf8'));
  const issuerOk = ['https://accounts.google.com', 'accounts.google.com'].includes(claims.iss);
  if (!issuerOk || claims.aud !== process.env.GOOGLE_CLIENT_ID || !claims.sub || (claims.exp ?? 0) * 1000 < Date.now()) {
    throw new Error('Google ID token failed validation');
  }
  if (!claims.email || claims.email_verified !== true) throw Object.assign(new Error('Google email not verified'), { code: 'unverified' });
  return { sub: String(claims.sub), email: String(claims.email).toLowerCase(), name: String(claims.name || claims.given_name || '').trim() };
}
