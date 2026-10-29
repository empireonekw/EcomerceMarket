import Image from 'next/image';
import Link from 'next/link';
import { Download, LayoutGrid, MessageSquare, ShoppingBag, Star, UserRound } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { getUserPurchases } from '@/lib/data/orders';
import { getUserReviewMap } from '@/lib/data/reviews';
import { formatPrice, NEUTRAL_BLUR_DATA_URL } from '@/lib/utils';
import { Avatar } from '@/components/UserMenu';
import { DeleteAccount, NameForm, PasswordForm, SessionControls } from '@/components/profile/AccountForms';
import ReviewButton from '@/components/profile/ReviewButton';
import Pagination from '@/components/Pagination';
import SignOutButton from '@/components/SignOutButton';

export const metadata = { title: 'My account', robots: { index: false } };

const ROLE_LABELS = { admin: 'Administrator', seller: 'Seller', customer: 'Customer' };

const TABS = [
  { id: 'profile', label: 'Profile', icon: UserRound },
  { id: 'downloads', label: 'My Purchases', icon: ShoppingBag },
];
// The active section: a white pill lifted off the tinted canvas (same as the admin and seller dashboards).
const ACTIVE = 'bg-white font-medium text-ink shadow-[0_1px_2px_rgba(16,16,16,0.06),0_6px_16px_-8px_rgba(16,16,16,0.18)]';
const IDLE = 'text-stone-600 hover:bg-black/[0.04] hover:text-ink';

const fmtDate = (d, opts = { dateStyle: 'medium' }) => new Date(d).toLocaleDateString('en-US', opts);
const fmtDateTime = (d) => new Date(d).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });

const PURCHASES_PAGE_SIZE = 8;

function DownloadsTab({ purchases, reviews, authorName, page }) {
  if (purchases.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-stone-300 bg-white px-6 py-14 text-center">
        <p className="font-medium">No purchases yet</p>
        <p className="mx-auto mt-2 max-w-md text-sm text-stone-500">
          Items you buy while logged in appear here. Bought something as a guest? Open its receipt link and choose
          “Save to my account”.
        </p>
        <Link href="/products" className="btn btn-md btn-dark mt-6">
          Browse products
        </Link>
      </div>
    );
  }

  const totalPages = Math.max(1, Math.ceil(purchases.length / PURCHASES_PAGE_SIZE));
  const current = Math.min(Math.max(1, Number.parseInt(page, 10) || 1), totalPages);
  const shown = purchases.slice((current - 1) * PURCHASES_PAGE_SIZE, current * PURCHASES_PAGE_SIZE);

  return (
    <>
      <ul className="space-y-3">
        {shown.map((p) => (
          <li key={`${p.orderId}-${p.productId}`} className="flex flex-col gap-4 rounded-2xl border border-stone-200 bg-white p-4 shadow-card sm:flex-row sm:items-center">
            <div className="flex min-w-0 flex-1 items-center gap-4">
              <Link href={`/products/${p.slug}`} className="relative aspect-[4/3] w-24 shrink-0 overflow-hidden rounded-xl bg-stone-100">
                {p.coverImage && <Image src={p.coverImage} alt="" fill sizes="96px" placeholder="blur" blurDataURL={NEUTRAL_BLUR_DATA_URL} className="object-cover" />}
              </Link>
              <div className="min-w-0">
                <Link href={`/products/${p.slug}`} className="line-clamp-2 font-medium hover:underline">
                  {p.title}
                </Link>
                <p className="mt-1 text-sm text-stone-500">
                  <span className="font-medium text-ink">{p.pricePaid === 0 ? 'Free' : formatPrice(p.pricePaid, p.currency)}</span>
                  {' · '}Purchased <time dateTime={p.purchasedAt}>{fmtDate(p.purchasedAt)}</time>
                  {' · '}Order #{p.orderNumber}
                </p>
                <p className="mt-0.5 text-xs text-stone-500">
                  {p.downloadCount === 0
                    ? 'Not downloaded yet'
                    : `Downloaded ${p.downloadCount}× · last ${fmtDateTime(p.lastDownloadedAt)}`}
                  {' · '}Re-download any time
                </p>
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-3 sm:flex-col sm:items-end">
              <a href={p.downloadUrl} rel="noreferrer" className="btn btn-md btn-primary">
                <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path d="M12 3v12m0 0-4-4m4 4 4-4M5 19h14" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Download File
              </a>
              <ReviewButton productId={p.productId} productTitle={p.title} authorName={authorName} existingRating={reviews[p.productId]} />
            </div>
          </li>
        ))}
      </ul>
      <Pagination page={current} totalPages={totalPages} basePath="/profile" params={{ tab: 'downloads' }} />
    </>
  );
}

function ProfileTab({ user, purchaseCount }) {
  return (
    <div className="grid gap-6 lg:grid-cols-[20rem_1fr] lg:items-start">
      <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-card sm:p-6">
        <h2 className="headline text-2xl">Account details</h2>
        <dl className="mt-4 space-y-3 text-sm">
          {[
            ['Name', user.name],
            ['Email', user.email],
            ['Member since', fmtDate(user.createdAt, { dateStyle: 'long' })],
            ['Account type', ROLE_LABELS[user.role] ?? 'Customer'],
            ...(user.role === 'customer' ? [['Purchases', String(purchaseCount)]] : []),
            ...(user.role === 'seller' && user.storeName ? [['Shop', user.storeName]] : []),
          ].map(([k, v]) => (
            <div key={k}>
              <dt className="text-stone-500">{k}</dt>
              <dd className="mt-0.5 break-words font-medium">{v}</dd>
            </div>
          ))}
        </dl>
        {WORKSPACES[user.role] && (
          <Link href={WORKSPACES[user.role].href} className="btn btn-md btn-outline mt-5 w-full">
            {WORKSPACES[user.role].label}
          </Link>
        )}
      </section>
      <div className="space-y-6">
        <NameForm initialName={user.name} />
        <PasswordForm email={user.email} />
        <SessionControls expiresAt={user.session.expiresAt} />
        {user.role !== 'admin' && <DeleteAccount role={user.role} />}
      </div>
    </div>
  );
}

// Sellers and admins don't shop on their account: they get settings only, plus a link to their workspace.
const WORKSPACES = {
  admin: { href: '/admin', label: 'Open admin dashboard', short: 'Admin dashboard' },
  seller: { href: '/seller/dashboard', label: 'Open seller dashboard', short: 'Seller dashboard' },
};

function Stat({ icon: Icon, label, value }) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-3 shadow-card sm:p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-xs text-stone-500 sm:text-sm">{label}</p>
        <span className="hidden size-8 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700 sm:grid">
          <Icon size={16} strokeWidth={1.75} aria-hidden="true" />
        </span>
      </div>
      <p className="headline mt-1 text-2xl tabular-nums sm:mt-2 sm:text-3xl">{value}</p>
    </div>
  );
}

export default async function ProfilePage({ searchParams }) {
  const { tab: rawTab, page } = await searchParams;
  const requested = TABS.some((t) => t.id === rawTab) ? rawTab : 'profile';
  const user = await requireUser(`/profile${requested === 'profile' ? '' : `?tab=${requested}`}`);
  const isCustomer = user.role === 'customer';
  const tab = isCustomer ? requested : 'profile';
  const [purchases, reviews] = isCustomer ? await Promise.all([getUserPurchases(user.id), getUserReviewMap(user.id)]) : [[], {}];
  const downloads = purchases.reduce((n, p) => n + (p.downloadCount ?? 0), 0);
  const item = (active) => `flex items-center gap-3 rounded-xl px-3 py-2 text-[13.5px] transition ${active ? ACTIVE : IDLE}`;

  return (
    <div className="bg-canvas">
      <div className="container-page grid gap-8 py-8 sm:py-12 lg:grid-cols-[15rem_1fr] lg:items-start">
        {/* Account menu: on the tinted canvas, like the dashboards' sidebar. */}
        <aside className="lg:sticky lg:top-24">
          <div className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-card ring-1 ring-black/[0.04]">
            <Avatar name={user.name} className="size-10 text-sm" />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{user.name}</p>
              <p className="truncate text-xs text-stone-500">{ROLE_LABELS[user.role] ?? 'Customer'}</p>
            </div>
          </div>
          <nav aria-label="Account sections" className="mt-5">
            <p className="mb-1.5 px-3 text-[11px] font-semibold tracking-wider text-stone-400 uppercase">Account</p>
            {/* Sections are links (URL state): shareable, back-button friendly, no client JS. */}
            <ul className="flex gap-1 overflow-x-auto lg:flex-col lg:gap-0.5">
              {(isCustomer ? TABS : TABS.slice(0, 1)).map(({ id, label, icon: Icon }) => (
                <li key={id} className="shrink-0">
                  <Link href={id === 'profile' ? '/profile' : `/profile?tab=${id}`} aria-current={tab === id ? 'page' : undefined} className={item(tab === id)}>
                    <Icon size={18} strokeWidth={1.75} aria-hidden="true" className={tab === id ? 'text-brand-700' : ''} />
                    <span className="flex-1">{label}</span>
                    {id === 'downloads' && purchases.length > 0 && (
                      <span className="rounded-full bg-brand-500 px-1.5 py-0.5 text-[11px] leading-none font-semibold text-ink tabular-nums">{purchases.length}</span>
                    )}
                  </Link>
                </li>
              ))}
              {isCustomer && (
                <li className="shrink-0">
                  <Link href="/messages" className={item(false)}>
                    <MessageSquare size={18} strokeWidth={1.75} aria-hidden="true" />
                    <span className="flex-1">Messages</span>
                  </Link>
                </li>
              )}
              {WORKSPACES[user.role] && (
                <li className="shrink-0">
                  <Link href={WORKSPACES[user.role].href} className={item(false)}>
                    <LayoutGrid size={18} strokeWidth={1.75} aria-hidden="true" />
                    <span className="flex-1">{WORKSPACES[user.role].short}</span>
                  </Link>
                </li>
              )}
            </ul>
          </nav>
          <div className="mt-5 hidden space-y-2 lg:block">
            <Link href="/products" className="group block rounded-2xl bg-ink p-4 text-white">
              <p className="text-xs text-stone-400">Find something new</p>
              <p className="mt-0.5 text-sm font-medium">Browse the marketplace</p>
              <span className="mt-3 inline-flex rounded-full bg-brand-500 px-3 py-1.5 text-xs font-medium text-ink transition-colors group-hover:bg-brand-600">Shop now</span>
            </Link>
            <SignOutButton className="w-full rounded-xl px-3 py-2 text-left text-[13.5px] text-stone-600 transition hover:bg-black/[0.04] hover:text-ink" />
          </div>
        </aside>

        <div className="min-w-0">
          <header>
            <h1 className="truncate font-serif text-3xl font-[420] tracking-[-0.02em] text-ink sm:text-[2.5rem] sm:leading-[1.1]">Hi, {user.name.split(' ')[0]}</h1>
            <p className="mt-1 truncate text-sm text-stone-500">
              {user.email} · Member since {fmtDate(user.createdAt, { month: 'long', year: 'numeric' })}
            </p>
          </header>

          {isCustomer && (
            <section aria-label="Your activity" className="mt-6 grid grid-cols-3 gap-2 sm:gap-3">
              <Stat icon={ShoppingBag} label="Purchases" value={purchases.length} />
              <Stat icon={Download} label="Downloads" value={downloads} />
              <Stat icon={Star} label="Reviews written" value={Object.keys(reviews).length} />
            </section>
          )}

          <div className="mt-8">
            {tab === 'downloads' ? <DownloadsTab purchases={purchases} reviews={reviews} authorName={user.name} page={page} /> : <ProfileTab user={user} purchaseCount={purchases.length} />}
          </div>
        </div>
      </div>
    </div>
  );
}
