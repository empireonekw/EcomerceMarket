import { NextResponse } from 'next/server';
import { clientIp } from '@/lib/client-ip';
import { rateLimit } from '@/lib/rate-limit';
import { flagIp, HUMAN_COOKIE, needsRobotCheck, ROBOT_CHECK_HEADER, VERIFY_API, VERIFY_PAGE } from '@/lib/robot-check';

// Must match SESSION_COOKIE in lib/auth.js (not imported: lib/auth.js is server-only + DB-backed).
const SESSION_COOKIE = 'apex_session';
const PROTECTED = ['/admin', '/profile', '/seller', '/messages'];

/**
 * Site-wide flood protection, per visitor IP and minute, before anything renders or touches the database.
 * Routes keep their own, stricter limits on top (login 10 per 15 min, signup 5 per hour, contact, search…).
 * Link prefetches are excluded by the matcher; requests with no client IP (the server calling itself, e.g. the image
 * optimizer, and local dev) are never limited.
 * Going over a limit flags the IP (lib/robot-check.js): until it ticks "I'm not a robot" on /verify, its pages
 * redirect there and its API calls get 429 { code: 'robot_check' }. Doing it again brings the check back.
 * Before the limits: probes for WordPress/PHP/.env files get 404 and flag the IP; attack tools and scrapers get 403.
 * The live server runs several workers, each counting on its own, so nginx adds one shared per-IP limit in front
 * (scripts/server/setup.sh).
 */
const LIMITS = {
  auth: { limit: 30, windowMs: 60_000 }, // /api/auth/* — sign-in, sign-up, session
  apiWrite: { limit: 90, windowMs: 60_000 }, // any other POST / PUT / PATCH / DELETE
  apiRead: { limit: 300, windowMs: 60_000 }, // API GETs (search autocomplete, media, inbox…)
  page: { limit: 240, windowMs: 60_000 }, // page loads and client-side navigations
};

// Rankkw's server calls these for every seller connected to it, all from one IP: they're left out of the per-IP limits
// and check their own Bearer token or shared secret, with per-seller limits (lib/rankkw-link.js).
const RANKKW_SERVER_ROUTES = /^\/api\/integrations\/rankkw\/(token|me|categories|upload-ticket|products|products\/status)$/;

// Probes for software this site doesn't run (WordPress, PHP, server files like .env or .git): only attack scanners ask
// for these. Answered 404 at once, and the IP is flagged, so its next pages meet the robot check.
const SCANNER_PATH =
  /(?:^|\/)\.(?:env|git|svn|hg|aws|ssh|htaccess|htpasswd|DS_Store)(?:[/.]|$)|^\/(?:wp-(?:admin|login|content|includes|config)|xmlrpc|phpmyadmin|pma|cgi-bin|vendor\/phpunit|server-status|actuator|boaform|HNAP1)(?:[/.]|$)|\.(?:php\d?|aspx?|jsp|cgi)$/i;
// No User-Agent at all, attack tools, scripting libraries and the most aggressive scrapers (search engines, social
// previews and browsers are fine). Refused with 403 before anything runs.
const BAD_AGENT =
  /sqlmap|nikto|nmap|masscan|zgrab|nuclei|wpscan|dirbuster|gobuster|ffuf|feroxbuster|acunetix|netsparker|openvas|w3af|whatweb|python-requests|python-urllib|aiohttp|go-http-client|scrapy|libwww-perl|bytespider|mj12bot|dotbot|blexbot|petalbot|ahrefsbot|semrushbot|dataforseobot/i;
// Machines that may call with plain scripts: the uptime check and PayFast's payment notices (Rankkw's routes above too).
const MACHINE_ROUTES = /^\/api\/(?:health|payments\/payfast\/notify)$/;
const notFound = () => new NextResponse('Not found', { status: 404, headers: { 'Cache-Control': 'no-store' } });
const refused = () => new NextResponse('Forbidden', { status: 403, headers: { 'Cache-Control': 'no-store' } });

function tierOf(request) {
  const { pathname } = request.nextUrl;
  if (!pathname.startsWith('/api/')) return 'page';
  if (pathname.startsWith('/api/auth/')) return 'auth';
  return ['GET', 'HEAD'].includes(request.method) ? 'apiRead' : 'apiWrite';
}

/** The robot check: pages go to /verify (and come back to `next` after), API calls get a 429 the browser acts on. */
function robotCheck(request, tier) {
  const headers = { 'Cache-Control': 'no-store', [ROBOT_CHECK_HEADER]: 'required' };
  if (tier !== 'page') {
    return NextResponse.json(
      { error: 'Too many requests. Please confirm you’re not a robot to continue.', code: 'robot_check', verify: VERIFY_PAGE },
      { status: 429, headers },
    );
  }
  const back = new URLSearchParams(request.nextUrl.search);
  back.delete('_rsc'); // client-side navigations carry Next's own cache-busting parameter
  const verify = new URL(VERIFY_PAGE, request.url);
  verify.searchParams.set('next', request.nextUrl.pathname + (back.size ? `?${back}` : ''));
  return NextResponse.redirect(verify, { headers });
}

export function proxy(request) {
  const ip = clientIp(request);
  const { pathname: path } = request.nextUrl;
  // The check itself stays reachable (POST /api/robot-check has its own, stricter limit).
  const isVerify = path === VERIFY_PAGE || path === VERIFY_API;
  if (SCANNER_PATH.test(path)) {
    if (ip !== 'local') flagIp(ip);
    return notFound();
  }
  // The server calling itself (e.g. the image optimizer) has no client IP and may send no User-Agent: never refused.
  if (ip !== 'local' && !RANKKW_SERVER_ROUTES.test(path) && !MACHINE_ROUTES.test(path)) {
    const agent = request.headers.get('user-agent') ?? '';
    if (!agent.trim() || BAD_AGENT.test(agent)) return refused();
  }
  if (ip !== 'local' && !isVerify && !RANKKW_SERVER_ROUTES.test(path)) {
    const tier = tierOf(request);
    if (needsRobotCheck(ip, request.cookies.get(HUMAN_COOKIE)?.value)) return robotCheck(request, tier);
    const result = rateLimit(`global:${tier}:${ip}`, LIMITS[tier]);
    if (!result.ok) {
      flagIp(ip);
      return robotCheck(request, tier);
    }
  }

  // Optimistic gate for signed-in areas: no session cookie → straight to /login?next=…, before any rendering.
  // This is NOT the security boundary — every protected page, data function and API route verifies the
  // JWT signature, token version and role itself (lib/auth.js).
  const { pathname, search } = request.nextUrl;
  if (PROTECTED.some((p) => pathname === p || pathname.startsWith(`${p}/`)) && !request.cookies.has(SESSION_COOKIE)) {
    const login = new URL('/login', request.url);
    login.searchParams.set('next', pathname + search);
    return NextResponse.redirect(login);
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/api/:path*',
    {
      // Pages: everything except build assets, optimized images, metadata files and static files — and not prefetches.
      source: '/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\.(?:png|jpe?g|gif|webp|avif|svg|ico|txt|xml|woff2?)$).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};
