// The live system map for Admin → System Health: every box (node) in the flow diagram, which requests belong to it
// and how they connect. Shared by the recorder (lib/monitor-store.js, loaded by server.js), the health snapshot
// (lib/data/monitor.js) and the diagram (components/admin/LiveFlow.jsx). Plain JS, relative imports only.

/**
 * Columns, left → right, like a call graph: visitors → edge → proxy → pages / API areas → services.
 * `prefixes`: request paths counted for an API node (longest match wins; every other non-asset path is "pages").
 */
export const MONITOR_NODES = [
  { id: 'visitors', col: 0, label: 'Visitors', sub: 'Browsers & apps', kind: 'external' },
  { id: 'edge', col: 1, label: 'Cloudflare + nginx', sub: 'HTTPS · real visitor IP', kind: 'external' },
  { id: 'proxy', col: 2, label: 'proxy.js', sub: 'Rate limits · sign-in gate', kind: 'layer' },

  { id: 'pages', col: 3, label: 'Pages', sub: 'Storefront & dashboards', kind: 'route' },
  { id: 'auth', col: 3, label: '/api/auth', sub: 'Login · signup · session', kind: 'route', prefixes: ['/api/auth'] },
  { id: 'catalog', col: 3, label: '/api/products', sub: 'Products · search · reviews', kind: 'route', prefixes: ['/api/products', '/api/search', '/api/categories', '/api/reviews'] },
  { id: 'checkout', col: 3, label: '/api/orders', sub: 'Checkout · downloads', kind: 'route', prefixes: ['/api/orders', '/api/downloads'] },
  { id: 'messages', col: 3, label: '/api/messages', sub: 'Inbox · chat', kind: 'route', prefixes: ['/api/messages'] },
  { id: 'seller', col: 3, label: '/api/seller', sub: 'Listings · payouts · uploads', kind: 'route', prefixes: ['/api/seller'] },
  { id: 'admin', col: 3, label: '/api/admin', sub: 'Admin actions', kind: 'route', prefixes: ['/api/admin'] },
  { id: 'contact', col: 3, label: '/api/contact', sub: 'Contact form', kind: 'route', prefixes: ['/api/contact'] },
  { id: 'files', col: 3, label: '/api/files', sub: 'Product media', kind: 'route', prefixes: ['/api/files'] },
  { id: 'health', col: 3, label: '/api/health', sub: 'Deploy check', kind: 'route', prefixes: ['/api/health'] },

  { id: 'mongodb', col: 4, label: 'MongoDB', sub: 'Database', kind: 'service' },
  { id: 'socket', col: 4, label: 'Socket.IO', sub: 'Live messaging', kind: 'service' },
  { id: 'storage', col: 4, label: 'File storage', sub: 'Uploads & downloads', kind: 'service' },
  { id: 'recaptcha', col: 4, label: 'reCAPTCHA', sub: 'Google bot check', kind: 'service' },
  { id: 'payments', col: 4, label: 'Payments', sub: 'Payment gateway', kind: 'service' },
];

const ROUTE_IDS = MONITOR_NODES.filter((n) => n.kind === 'route').map((n) => n.id);
const DEPENDS_ON = {
  pages: ['mongodb'],
  auth: ['mongodb', 'recaptcha'],
  catalog: ['mongodb'],
  checkout: ['mongodb', 'payments', 'storage'],
  messages: ['mongodb', 'socket'],
  seller: ['mongodb', 'storage'],
  admin: ['mongodb'],
  contact: ['mongodb'],
  files: ['storage'],
  health: ['mongodb'],
};

/** [from, to] arrows of the diagram. */
export const MONITOR_EDGES = [
  ['visitors', 'edge'],
  ['edge', 'proxy'],
  ['edge', 'socket'], // live messaging goes straight to Socket.IO, not through proxy.js
  ...ROUTE_IDS.map((id) => ['proxy', id]),
  ...Object.entries(DEPENDS_ON).flatMap(([from, tos]) => tos.map((to) => [from, to])),
];

const PREFIXES = MONITOR_NODES.flatMap((n) => (n.prefixes ?? []).map((p) => [p, n.id])).sort((a, b) => b[0].length - a[0].length);
const ASSET = /^\/(?:_next\/|favicon|robots\.txt|sitemap\.xml)|\.(?:png|jpe?g|gif|webp|avif|svg|ico|css|js|map|txt|woff2?)$/i;

/** The node a request path belongs to, or null for build assets (not tracked). */
export function nodeForPath(pathname) {
  const path = String(pathname ?? '/').split('?')[0];
  if (path.startsWith('/api/')) {
    const hit = PREFIXES.find(([p]) => path === p || path.startsWith(`${p}/`));
    return hit ? hit[1] : 'pages'; // an /api route not on the map still shows up somewhere
  }
  return ASSET.test(path) ? null : 'pages';
}
