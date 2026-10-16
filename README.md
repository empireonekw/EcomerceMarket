# Ecomerce Market

Digital products marketplace (templates, e-books, software, vector packs) built with
**Next.js 16 (App Router, JavaScript)**, **Tailwind CSS v4** and **MongoDB Atlas + Mongoose 9**.

## Quick start

```bash
npm install
npm run seed         # idempotent demo categories + products (upserts by slug)
npm run db:indexes   # sync MongoDB indexes (run on every deploy — autoIndex is off in production)
npm run dev
```

Environment variables live in `.env.local` (gitignored). Template: `.env.example`.

## Structure

```
app/
  layout.jsx            Root layout (fonts, metadata, Navbar/Footer)
  page.jsx              Homepage — ISR every 5 min
  loading.jsx           Root skeleton
  error.jsx             Segment error boundary (receives { error, retry })
  global-error.jsx      Root-layout error boundary
  not-found.jsx
  products/
    page.jsx            Listing: category / tag / search / sort / pagination via searchParams
    loading.jsx
    [slug]/page.jsx     Product detail — on-demand ISR, React cache() dedupes metadata + page query
    [slug]/loading.jsx
  api/
    products/route.js           GET  ?page&limit&category&tag&q&sort
    products/[slug]/route.js    GET
    categories/route.js         GET
    health/route.js             GET  (pings MongoDB)
components/             Navbar, Footer, ProductCard, ProductGrid (+ skeleton), Pagination
lib/
  mongodb.js            Cached connection (globalThis) — safe for HMR + serverless
  data/                 server-only data access used by pages AND API routes
  utils.js              slugify, formatPrice, query parsing (pure)
  site.js               Brand config
models/                 User, Category, Product, Order
scripts/                seed.js, sync-indexes.js
```

## API

| Method | Route | Notes |
| --- | --- | --- |
| GET | `/api/products` | `q`, `category`, `tag`, `sort` (`newest` · `price` · `-price` · `popular`), `page`, `limit` (≤ 48) |
| POST | `/api/products` | Admin — `Authorization: Bearer $ADMIN_API_KEY`. Slug auto-generated from title |
| GET | `/api/search?q=&limit=` | Live autocomplete (≤8 items + total). Same matching as `/products?q=`: every word must prefix a word in title, tags, summary, file format or category name |
| GET | `/api/products/:id` | Full public details by id **or** slug (never `downloadUrl`) |
| PUT | `/api/products/:id` | Admin — partial update; slug only changes if `slug` is sent |
| DELETE | `/api/products/:id` | Admin — deletes, or unpublishes if the product has orders |
| GET | `/api/orders` | Admin — `q` (email/order id), `status`, `page`, `limit` |
| POST | `/api/orders` | Checkout (see below) |
| POST | `/api/auth/login` · `/api/auth/logout` | Admin session |
| GET | `/api/categories` | Active categories + product counts |
| GET | `/api/health` | DB ping |

```bash
curl -X POST http://localhost:3000/api/products \
  -H "Authorization: Bearer $ADMIN_API_KEY" -H "Content-Type: application/json" \
  -d '{"title":"Resume Template Pack","category":"templates","price":1900,
       "description":"10 ATS-friendly resume templates.","downloadUrl":"products/resume-pack.zip",
       "coverImage":"https://images.unsplash.com/photo-...","tags":"resume, career"}'
```

`category` accepts a slug or ObjectId. `price` is integer cents. Unknown fields (e.g. `salesCount`) are ignored.
A blur placeholder is generated from `coverImage` with sharp at creation time.

## Multi-vendor marketplace

```
Sell With Us ─▶ /sell/signup (seller account) ─▶ /login (email prefilled) ─▶ /seller/onboarding (shop name + description) ─▶ /seller/dashboard
/seller/dashboard ─▶ "Add your payout details" alert until a bank account / EasyPaisa / JazzCash wallet is saved
/seller/products/add ─▶ status 'pending' ─▶ admin approves (/admin/products?status=pending) ─▶ live
checkout ─▶ Transaction ledger (10% commission / 90% seller) + seller.pendingPayout ─▶ /admin/payouts ─▶ Mark as Paid
```

- **Roles:** `customer` (`/signup`) and `seller` (`/sell/signup`) are separate accounts — a shopping account can't
  become a seller; `/sell/signup` asks it to sign out first. (`/sell` permanently redirects there.) `admin` only via `create-admin`.
- **Shop setup gate:** a seller account has no `seller.storeName` until `/seller/onboarding` is completed.
  `requireSellerStore()` (every page in `app/seller/(workspace)`) and the seller product/payout APIs send it back there,
  so an abandoned setup is resumed on the next visit or login. Payout details are added later from the dashboard.
- **Account menus by role:** customers get Profile + My purchases; sellers get their workspace (no purchases);
  admins get admin links.
- **Money model (integer cents):** every order line writes a `Transaction` (`gross = commission + sellerEarning`,
  with the rate used). Seller counters on `User.seller` (`totalEarnings`, `pendingPayout`, `paidPayout`) are updated
  in the **same MongoDB transaction** as the order and ledger. Commission rounds to the cent; the seller gets the
  remainder, so the split always sums exactly. Platform-owned products (no `sellerId`) keep 100%.
  Tax/fees stay with the platform. Rate: `NEXT_PUBLIC_COMMISSION_RATE` (default `0.10`).
- **Moderation:** seller uploads are `status: 'pending'`; only `PUBLIC_PRODUCT_FILTER` (`isPublished && approved`)
  products are listed or purchasable. Sellers can't set status, visibility, featured, slug or `sellerId`.
- **Files:** sellers submit `pdfFileUrl` — a schema alias of the private `downloadUrl`, delivered through the same
  signed, expiring download links.
- **Payouts:** sellers may request one at a time (`Payout` status `requested`). Admin "Mark as Paid" clears
  **exactly the amount shown/sent** (newer sales stay pending), snapshots the destination, stores an optional
  transaction reference, and writes a negative `payout` ledger entry. Bank details are `select: false`.
- **API:** `POST /api/seller/onboarding { storeName, storeDescription }` ·
  `PUT /api/seller/profile { bankDetails } | { storeName, storeDescription }` · `POST /api/seller/products` ·
  `POST /api/seller/payouts` · `POST /api/admin/payouts { sellerId, amount?, reference? }` ·
  `PUT /api/products/:id { status }` (admin approval).
- **Upgrading an existing database:** `npm run migrate:marketplace` (marks pre-existing products approved), then `npm run db:indexes`.

## Customer accounts

`/signup` · `/login` · `/profile` (Profile tab + My Purchases tab). One login for customers and admins.

- **Flow:** sign-up creates the account without signing in, then opens `/login?registered=1` with the email
  prefilled (handed over in `sessionStorage`, never in the URL); after that first login the user lands on the
  homepage (or `?next=`). Logging out shows a "Signing you out…" screen and returns to the homepage.

- **Session:** HS256 JWT in an httpOnly, SameSite=Lax cookie (`apex_session`; customers 30 days, admins 8h).
  The JWT carries `ver` = `user.tokenVersion`; a password change or "Log out of all devices" bumps it and
  revokes every other session instantly. A non-secret `apex_auth=1` hint cookie lets `AuthContext` skip
  `/api/auth/me` for logged-out visitors, so storefront pages stay static.
- **API:** `POST /api/auth/signup` · `POST /api/auth/login` · `POST /api/auth/logout[?all=1]` ·
  `GET /api/auth/me` (user + session) · `PATCH /api/auth/me` (`{ name }` or `{ currentPassword, newPassword }`).
- **Purchases are tied to the account, not the email.** Emails aren't verified, so matching orders by email
  would let anyone who signs up with your address download your files. Orders placed while logged in are
  linked automatically; guest orders are linked from their receipt page ("Save to my account"), where the
  private receipt token proves ownership (`POST /api/orders/claim`).
- **Download history:** each purchased item tracks `downloadCount` and `lastDownloadedAt`.
- **Reviews (verified buyers only):** My Purchases → "Write a review" (1–5 stars, 20–600 characters). `POST /api/reviews`
  only accepts a customer with a paid, completed order **linked to their account** for that product; one review per
  buyer per product (`Review` model snapshots the buyer's name and product title). The homepage "Loved by buyers"
  section shows the newest six with the real average and count, flips each card on hover/focus to reveal the
  reviewer. Until the first real review exists it shows the sample reviews defined in
  `components/home/Reviews.jsx`. The form tells buyers their name is shown publicly.

## Admin portal

```bash
npm run create-admin -- --email you@example.com --name "Your Name"   # prints a generated password once
```

Sign in at `/login` → `/admin` (Dashboard · Products · Add product · Users · Orders · Payouts).

- **Users (`/admin/users`):** every account with role tabs, search, a status (active · never logged in · shop setup
  pending · payout details missing), paid purchases (matched by email, guest orders included — display only) and
  seller totals; `/admin/users/:id` adds the shop, masked payout method, products, sales, payouts and orders.
  **Delete account** (`DELETE /api/admin/users/:id`, admin session only — not the API key) removes a customer or
  seller after a confirmation dialog. It refuses admins, yourself, and sellers with a pending payout. A seller's
  never-sold products are deleted; purchased ones are unpublished so buyers keep their downloads. Orders are kept
  (unlinked from the account). Runs in one MongoDB transaction.
- **Auth:** admins are users with `role: 'admin'` (only ever set by `create-admin`; signup only creates
  customers and sellers). `proxy.js` only redirects when there's no cookie — the real check runs in every admin page and
  data function (`requireAdmin()` in `lib/auth.js`) and every admin API route (`authorizeAdminRequest()`),
  which also accepts `Authorization: Bearer $ADMIN_API_KEY` for scripts.
- **CSRF:** cookie-authenticated writes must come from the same origin (checked server-side).
- **Rate limits:** login 10/15 min per IP + 10/15 min per account; signup 5/hour per IP; password change
  5/15 min per account; checkout 10/min per IP. In-memory —
  swap `lib/rate-limit.js` for Redis/Upstash when running multiple instances.
- **Deleting products:** unsold products are deleted; sold ones are unpublished instead so buyers keep their downloads.

## Checkout & delivery

```
Add to cart ─▶ CartDrawer ─▶ /checkout ─▶ POST /api/orders ─▶ /checkout/success?order=…&token=…
                                              │                    │
                                              │                    └─ fresh signed link per item ─▶ GET /api/downloads/:token
                                              └─ re-prices from DB, lib/payments.js charges, saves completed order
```

- **Cart:** `context/CartContext.js` (localStorage, cross-tab sync). `useCart()` → `addToCart`, `removeFromCart`, `clearCart`, `getCartTotal`, `openCart`…
- **Pricing:** `lib/pricing.js` is shared by the drawer and the server, so the shown total is the charged total.
  If prices change between add-to-cart and checkout, the API returns `409 price_changed` and the UI refreshes the cart.
- **Payments:** `lib/payments.js`. Free orders complete instantly. Paid orders complete instantly **only with
  `DEMO_CHECKOUT=true`** (local testing); otherwise they're refused (`402`) until a provider is wired in.
- **Receipts:** a random access token (only its SHA-256 is stored) unlocks `/checkout/success`.
- **Downloads:** HMAC-signed tokens (`AUTH_SECRET`), 24h expiry, re-checked against the order on every use,
  max 10 downloads per item. Storage keys resolve via `createSignedStorageUrl()` in `lib/storage.js` (plug in S3/R2).

## Conventions

- **Prices are integer cents** (`1999` = $19.99). Use `formatPrice()` for display.
- **`Product.downloadUrl` is `select: false`** and never leaves the server. For `deliveryType: 'file'`
  store a private storage key (S3/R2) and issue short-lived signed URLs only after verifying a paid `Order`;
  for `'external'` store the access link.
- **Order totals are computed server-side** from item snapshots in a `pre('validate')` hook.
- Server Components call `lib/data/*` directly — never `fetch()` their own API routes.
- Cover image hosts must be listed in `next.config.mjs → images.remotePatterns`.
