// The visitor's real IP address, for rate limits and reCAPTCHA. Shared by proxy.js and route handlers.
//
// The site runs behind Cloudflare → nginx → Node. nginx sets X-Real-IP to whoever connected to it (overwriting
// anything the client sent): the visitor, or — when nginx doesn't yet restore real IPs (scripts/server/setup.sh) —
// a Cloudflare edge server shared by thousands of visitors. Cloudflare's CF-Connecting-IP holds the visitor, but
// anyone can send that header, so it's only believed when the connection really came from Cloudflare.
// X-Forwarded-For's first entry is client-controlled: last resort only.

// https://www.cloudflare.com/ips-v4 and /ips-v6 (checked 29 October 2026; they change rarely).
const CLOUDFLARE_RANGES = [
  '173.245.48.0/20', '103.21.244.0/22', '103.22.200.0/22', '103.31.4.0/22', '141.101.64.0/18', '108.162.192.0/18',
  '190.93.240.0/20', '188.114.96.0/20', '197.234.240.0/22', '198.41.128.0/17', '162.158.0.0/15', '104.16.0.0/13',
  '104.24.0.0/14', '172.64.0.0/13', '131.0.72.0/22',
  '2400:cb00::/32', '2606:4700::/32', '2803:f800::/32', '2405:b500::/32', '2405:8100::/32', '2a06:98c0::/29', '2c0f:f248::/32',
];

/** An IPv4 or IPv6 address as { bits, value: BigInt }, or null. IPv4-mapped IPv6 (::ffff:1.2.3.4) counts as IPv4. */
function parseIp(raw) {
  const ip = String(raw ?? '').trim().replace(/^\[|\]$/g, '').replace(/%.*$/, '');
  const v4 = /^(?:::ffff:)?(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/i.exec(ip);
  if (v4) {
    const octets = v4.slice(1).map(Number);
    if (octets.some((o) => o > 255)) return null;
    return { bits: 32, value: octets.reduce((n, o) => (n << 8n) | BigInt(o), 0n) };
  }
  if (!ip.includes(':') || !/^[0-9a-f:]+$/i.test(ip)) return null;
  const [head, tail = ''] = ip.split('::');
  if (ip.split('::').length > 2) return null;
  const left = head ? head.split(':') : [];
  const right = tail ? tail.split(':') : [];
  const missing = 8 - left.length - right.length;
  if (missing < 0 || (!ip.includes('::') && missing !== 0)) return null;
  const groups = [...left, ...Array(missing).fill('0'), ...right];
  if (groups.some((g) => !/^[0-9a-f]{1,4}$/i.test(g))) return null;
  return { bits: 128, value: groups.reduce((n, g) => (n << 16n) | BigInt(parseInt(g, 16)), 0n) };
}

const RANGES = CLOUDFLARE_RANGES.map((cidr) => {
  const [base, len] = cidr.split('/');
  const { bits, value } = parseIp(base);
  const shift = BigInt(bits - Number(len));
  return { bits, shift, prefix: value >> shift };
});

export function isCloudflareIp(ip) {
  const parsed = parseIp(ip);
  return Boolean(parsed && RANGES.some((r) => r.bits === parsed.bits && parsed.value >> r.shift === r.prefix));
}

/** The visitor's IP from request headers (a Request / NextRequest), or 'local' when there are none (dev, health checks). */
export function clientIp(request) {
  const h = request.headers;
  const peer = h.get('x-real-ip')?.trim();
  const viaCloudflare = h.get('cf-connecting-ip')?.trim();
  if (peer && viaCloudflare && isCloudflareIp(peer) && parseIp(viaCloudflare)) return viaCloudflare;
  return peer || h.get('x-forwarded-for')?.split(',')[0].trim() || 'local';
}
