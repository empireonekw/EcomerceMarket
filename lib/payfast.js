import 'server-only';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { siteConfig } from '@/lib/site';

/**
 * Premier PayFast (Pakistan) hosted checkout, the "redirection model" of the Merchant Integration Guide:
 *
 *   1. getAccessToken(): server-to-server, trades MERCHANT_ID + SECURED_KEY + basket + amount for a one-time token.
 *      The amount is bound to that token, so the browser can't change what is charged.
 *   2. checkoutForm(): the fields the buyer's browser POSTs to PayFast's PostTransaction page. PayFast shows every
 *      method enabled on the merchant account there: Visa / Mastercard / UnionPay / PayPak cards, JazzCash, Easypaisa
 *      and other wallets, bank accounts and Raast. Card numbers and wallet PINs never touch this server.
 *   3. PayFast sends the result to SUCCESS_URL / FAILURE_URL (the buyer's browser) and to CHECKOUT_URL (server to
 *      server). verifyResult() checks its validation_hash, SHA-256 of "basket_id|key|merchant_id|err_code".
 *
 * Config (server env, never public):
 *   PAYFAST_MERCHANT_ID    Merchant / Partner ID from the PayFast portal
 *   PAYFAST_SECURED_KEY    Secured key issued at onboarding
 *   PAYFAST_SECRET_WORD    Optional: the portal's "Secret Word" (About You → Profile → Integration), if PayFast signs
 *                          results with it instead of the secured key; results signed with either are accepted
 *   PAYFAST_MERCHANT_NAME  Shown on the PayFast page (defaults to the site name)
 *   PAYFAST_ENV            "production" (default) or "sandbox"; PAYFAST_BASE_URL overrides the host entirely
 */

const HOSTS = {
  production: 'https://ipg1.apps.net.pk',
  sandbox: 'https://ipguat.apps.net.pk',
};
const TOKEN_PATH = '/Ecommerce/api/Transaction/GetAccessToken';
const POST_PATH = '/Ecommerce/api/Transaction/PostTransaction';
// PayFast's "approved" response code (some integrations report the two-digit form).
const SUCCESS_CODES = new Set(['000', '00']);

export class PayFastError extends Error {}

const env = (name) => (process.env[name] ?? '').trim();

export const payfastConfigured = () => Boolean(env('PAYFAST_MERCHANT_ID') && env('PAYFAST_SECURED_KEY'));

/** PayFast's origin (for the checkout form action and the Content-Security-Policy form-action list). */
export function payfastOrigin() {
  const override = env('PAYFAST_BASE_URL');
  if (override) return new URL(override).origin;
  return HOSTS[env('PAYFAST_ENV') === 'sandbox' ? 'sandbox' : 'production'];
}

/** "2800" / "2800.50": PayFast amounts are in rupees, from integer paisa. */
export const formatAmount = (paisa) => (paisa % 100 === 0 ? String(paisa / 100) : (paisa / 100).toFixed(2));

/** Step 1: a one-time access token for this basket and amount. */
export async function getAccessToken({ basketId, amountPaisa, currency = 'PKR' }) {
  const body = new URLSearchParams({
    MERCHANT_ID: env('PAYFAST_MERCHANT_ID'),
    SECURED_KEY: env('PAYFAST_SECURED_KEY'),
    BASKET_ID: basketId,
    TXNAMT: formatAmount(amountPaisa),
    CURRENCY_CODE: currency,
  });
  let res;
  try {
    res = await fetch(`${payfastOrigin()}${TOKEN_PATH}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body,
      signal: AbortSignal.timeout(15000),
      cache: 'no-store',
    });
  } catch (err) {
    throw new PayFastError(`PayFast unreachable: ${err.message}`);
  }
  const data = await res.json().catch(() => null);
  const token = data?.ACCESS_TOKEN ?? data?.access_token;
  if (!res.ok || !token) throw new PayFastError(`PayFast token request failed (${res.status}): ${JSON.stringify(data)?.slice(0, 300)}`);
  return token;
}

/**
 * Step 2: the form the browser submits to PayFast. `returnUrl` receives both outcomes (PayFast adds its result
 * fields); `notifyUrl` is the server-to-server confirmation.
 */
export function checkoutForm({ token, basketId, amountPaisa, currency = 'PKR', description, email, mobile, name, returnUrl, notifyUrl, customerIp }) {
  const fields = {
    MERCHANT_ID: env('PAYFAST_MERCHANT_ID'),
    MERCHANT_NAME: env('PAYFAST_MERCHANT_NAME') || siteConfig.name,
    TOKEN: token,
    PROCCODE: '00',
    TXNAMT: formatAmount(amountPaisa),
    CURRENCY_CODE: currency,
    CUSTOMER_MOBILE_NO: mobile,
    CUSTOMER_EMAIL_ADDRESS: email,
    // PayFast documents SIGNATURE and VERSION as free-form strings, not cryptographic signatures.
    SIGNATURE: randomBytes(16).toString('hex'),
    VERSION: `${siteConfig.name.toUpperCase()}-1.0`,
    TXNDESC: description.slice(0, 200),
    SUCCESS_URL: returnUrl,
    FAILURE_URL: returnUrl,
    CHECKOUT_URL: notifyUrl,
    BASKET_ID: basketId,
    // "Y-m-d H:i:s" in Pakistan time (UTC+5, no daylight saving), as in PayFast's sample integration.
    ORDER_DATE: new Date(Date.now() + 5 * 3600_000).toISOString().slice(0, 19).replace('T', ' '),
    TRAN_TYPE: 'ECOMM_PURCHASE',
  };
  if (name) fields.CUSTOMER_NAME = name.slice(0, 100);
  if (customerIp && customerIp !== 'local') fields.CUSTOMER_IPADDRESS = customerIp;
  return { action: `${payfastOrigin()}${POST_PATH}`, fields };
}

const sha256 = (s) => createHash('sha256').update(s).digest('hex');
const sameHex = (a, b) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

/**
 * Step 3: checks a result PayFast sent (query string or form body; keys are matched case-insensitively).
 * Returns null when it isn't a genuine PayFast result for this merchant.
 */
export function verifyResult(raw) {
  const p = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k.toLowerCase(), String(v ?? '').trim()]));
  const basketId = p.basket_id;
  const code = p.err_code;
  const hash = (p.validation_hash || '').toLowerCase();
  if (!basketId || !code || !/^[0-9a-f]{64}$/.test(hash)) return null;

  const merchantId = env('PAYFAST_MERCHANT_ID');
  const keys = [env('PAYFAST_SECURED_KEY'), env('PAYFAST_SECRET_WORD')].filter(Boolean);
  if (!keys.some((key) => sameHex(sha256(`${basketId}|${key}|${merchantId}|${code}`), hash))) return null;

  return {
    basketId,
    approved: SUCCESS_CODES.has(code),
    code,
    message: p.err_msg || '',
    transactionId: p.transaction_id || '',
    // Rupees, as PayFast reports them (may be absent on some notifications).
    amount: p.transaction_amount || '',
    method: p.paymentname || p.payment_name || '',
  };
}
