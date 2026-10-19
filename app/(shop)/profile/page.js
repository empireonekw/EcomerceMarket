import Image from 'next/image';
import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { getUserPurchases } from '@/lib/data/orders';
import { getUserReviewMap } from '@/lib/data/reviews';
import { formatPrice, NEUTRAL_BLUR_DATA_URL } from '@/lib/utils';
import { Avatar } from '@/components/UserMenu';
import { NameForm, PasswordForm, SessionControls } from '@/components/profile/AccountForms';
import ReviewButton from '@/components/profile/ReviewButton';
import Pagination from '@/components/Pagination';

export const metadata = { title: 'My account', robots: { index: false } };

const ROLE_LABELS = { admin: 'Administrator', seller: 'Seller', customer: 'Customer' };

const TABS = [
  { id: 'profile', label: 'Profile' },
  { id: 'downloads', label: 'My Purchases' },
];

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
          <li key={`${p.orderId}-${p.productId}`} className="flex flex-col gap-4 rounded-2xl border border-stone-200 bg-white p-4 sm:flex-row sm:items-center">
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
                  {' · '}
                  {p.downloadsRemaining} remaining
                </p>
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-3 sm:flex-col sm:items-end">
              {p.downloadsRemaining > 0 ? (
                <a href={p.downloadUrl} rel="noreferrer" className="btn btn-md btn-primary">
                  <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <path d="M12 3v12m0 0-4-4m4 4 4-4M5 19h14" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Download File
                </a>
              ) : (
                <span className="rounded-full bg-stone-100 px-4 py-2 text-center text-sm text-stone-500">Download limit reached</span>
              )}
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
      <section className="rounded-2xl border border-stone-200 bg-white p-5 sm:p-6">
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
      </div>
    </div>
  );
}

// Sellers and admins don't shop on their account: they get settings only, plus a link to their workspace.
const WORKSPACES = {
  admin: { href: '/admin', label: 'Open admin dashboard' },
  seller: { href: '/seller/dashboard', label: 'Open seller dashboard' },
};

export default async function ProfilePage({ searchParams }) {
  const { tab: rawTab, page } = await searchParams;
  const requested = TABS.some((t) => t.id === rawTab) ? rawTab : 'profile';
  const user = await requireUser(`/profile${requested === 'profile' ? '' : `?tab=${requested}`}`);
  const isCustomer = user.role === 'customer';
  const tab = isCustomer ? requested : 'profile';
  const [purchases, reviews] = isCustomer ? await Promise.all([getUserPurchases(user.id), getUserReviewMap(user.id)]) : [[], {}];

  return (
    <div className="container-page py-10 sm:py-14">
      <header className="flex items-center gap-4">
        <Avatar name={user.name} className="size-14 text-lg" />
        <div className="min-w-0">
          <h1 className="headline truncate text-3xl sm:text-4xl">Hi, {user.name.split(' ')[0]}</h1>
          <p className="truncate text-sm text-stone-500">
            {user.email} · Member since {fmtDate(user.createdAt, { month: 'long', year: 'numeric' })}
          </p>
        </div>
      </header>

      {/* Tabs are links (URL state): shareable, back-button friendly, no client JS. Customers only. */}
      {isCustomer && (
        <nav aria-label="Account sections" className="mt-10 inline-flex gap-1 rounded-full bg-stone-100 p-1">
          {TABS.map((t) => (
            <Link
              key={t.id}
              href={t.id === 'profile' ? '/profile' : `/profile?tab=${t.id}`}
              aria-current={tab === t.id ? 'page' : undefined}
              className={`rounded-full px-4 py-2 text-sm transition-colors ${tab === t.id ? 'bg-white text-black shadow-sm' : 'text-stone-600 hover:text-black'}`}
            >
              {t.label}
              {t.id === 'downloads' && purchases.length > 0 && (
                <span className="ml-2 rounded-full bg-black/5 px-2 py-0.5 text-xs text-stone-600">{purchases.length}</span>
              )}
            </Link>
          ))}
        </nav>
      )}

      <div className={isCustomer ? 'mt-8' : 'mt-10'}>
        {tab === 'downloads' ? <DownloadsTab purchases={purchases} reviews={reviews} authorName={user.name} page={page} /> : <ProfileTab user={user} purchaseCount={purchases.length} />}
      </div>
    </div>
  );
}
