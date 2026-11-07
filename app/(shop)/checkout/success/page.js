import Image from 'next/image';
import Link from '@/components/PrefetchLink';
import { notFound } from 'next/navigation';
import CopyLinkButton from '@/components/CopyLinkButton';
import ClaimOrderButton from '@/components/ClaimOrderButton';
import FileDownloads from '@/components/FileDownloads';
import { getOrderReceipt } from '@/lib/data/orders';
import { getCurrentUser } from '@/lib/auth';
import { ClearCartWhenPaid, RefreshWhilePending } from '@/components/PaymentStatusHelpers';
import { formatPkr } from '@/lib/pricing';
import { formatPrice, NEUTRAL_BLUR_DATA_URL } from '@/lib/utils';

// Private, per-buyer page: never cache, never index, never leak the token via Referer.
export const metadata = {
  title: 'Your downloads',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

const PAYMENT_LABELS = { demo: 'Demo (no charge)', free: 'Free order', payfast: 'PayFast' };

/** The round icon above the heading, one per payment state. */
function StateIcon({ state }) {
  if (state === 'pending') {
    return <span aria-hidden="true" className="mx-auto block size-14 animate-spin rounded-full border-4 border-brand-100 border-t-brand-600" />;
  }
  const failed = state === 'failed';
  return (
    <span className={`mx-auto grid size-14 place-items-center rounded-full ${failed ? 'bg-red-50 text-red-600' : 'bg-emerald-100 text-emerald-600'}`}>
      <svg aria-hidden="true" viewBox="0 0 24 24" className="size-7" fill="none" stroke="currentColor" strokeWidth="2.5">
        <path d={failed ? 'M7 7l10 10M17 7 7 17' : 'm5 12 4.5 4.5L19 7'} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

/** Ties the receipt to an account: already saved, save it now, or log in to save it. */
function AccountLinkPanel({ order, viewer, orderId, token }) {
  const box = 'mx-auto mt-6 max-w-md rounded-2xl border px-4 py-3 text-sm';
  if (order.user && viewer && order.user === viewer.id) {
    return (
      <p className={`${box} border-emerald-200 bg-emerald-50 text-emerald-800`}>
        Saved to your account.{' '}
        <Link href="/profile?tab=downloads" className="font-medium underline">
          View my purchases
        </Link>
      </p>
    );
  }
  if (order.user) return null; // linked to some account; don't reveal which
  if (viewer) {
    return (
      <div className={`${box} border-stone-200 bg-white`}>
        <p className="mb-3 text-stone-600">Keep this order with your other purchases as {viewer.email}.</p>
        <ClaimOrderButton orderId={orderId} token={token} />
      </div>
    );
  }
  const back = encodeURIComponent(`/checkout/success?order=${orderId}&token=${token}`);
  return (
    <p className={`${box} border-stone-200 bg-white text-stone-600`}>
      <Link href={`/login?next=${back}`} className="font-medium text-ink underline">
        Log in
      </Link>{' '}
      or{' '}
      <Link href={`/signup?next=${back}`} className="font-medium text-ink underline">
        create an account
      </Link>{' '}
      to save this order and re-download anytime.
    </p>
  );
}

export default async function CheckoutSuccessPage({ searchParams }) {
  const { order: orderId, token } = await searchParams;
  const [receipt, viewer] = await Promise.all([getOrderReceipt(orderId, token), getCurrentUser()]);
  if (!receipt) notFound();

  const { order, downloads } = receipt;
  const money = (cents) => formatPrice(cents, order.currency);
  const linkFor = new Map(downloads.map((d) => [d.productId, d]));
  const orderNumber = order._id.slice(-8).toUpperCase();
  const placedAt = new Date(order.paidAt ?? order.createdAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
  // paid → files · failed → try again · pending → PayFast hasn't confirmed yet (the page re-checks itself).
  const state = order.paymentStatus === 'paid' ? 'paid' : order.paymentStatus === 'failed' || order.paymentStatus === 'refunded' ? 'failed' : 'pending';
  const paymentLabel = [PAYMENT_LABELS[order.paymentProvider] ?? order.paymentProvider, order.charge?.method].filter(Boolean).join(' · ');

  return (
    <div className="container-page max-w-4xl py-10 sm:py-14">
      {/* ---------- Confirmation ---------- */}
      <header className="text-center">
        <StateIcon state={state} />
        {state === 'paid' && (
          <>
            <ClearCartWhenPaid orderId={order._id} />
            <h1 className="headline mt-6 text-4xl text-balance sm:text-5xl">Thank you! Your files are ready.</h1>
            <p className="mx-auto mt-3 max-w-lg text-stone-600">
              Order <span className="font-medium text-ink">#{orderNumber}</span> for{' '}
              <span className="font-medium text-ink">{order.buyerEmail}</span>. Bookmark this page. It’s your permanent
              access link.
            </p>
            <div className="mt-5 flex justify-center">
              <CopyLinkButton />
            </div>
            <AccountLinkPanel order={order} viewer={viewer} orderId={orderId} token={token} />
          </>
        )}
        {state === 'pending' && (
          <div role="status">
            <RefreshWhilePending />
            <h1 className="headline mt-6 text-4xl text-balance sm:text-5xl">Confirming your payment…</h1>
            <p className="mx-auto mt-3 max-w-lg text-stone-600">
              Order <span className="font-medium text-ink">#{orderNumber}</span>. We’re waiting for PayFast to confirm it. This
              usually takes a few seconds, and your files appear here as soon as it does. If you paid with a wallet, approve
              the request in your JazzCash or Easypaisa app.
            </p>
          </div>
        )}
        {state === 'failed' && (
          <div role="alert">
            <h1 className="headline mt-6 text-4xl text-balance sm:text-5xl">Your payment didn’t go through</h1>
            <p className="mx-auto mt-3 max-w-lg text-stone-600">
              {order.charge?.message ? `PayFast said: “${order.charge.message}”. ` : ''}No money was taken for order{' '}
              <span className="font-medium text-ink">#{orderNumber}</span>. Your cart is still saved, so you can try again or use
              another payment method.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link href="/checkout" className="btn btn-lg btn-primary">
                Try again
              </Link>
              <Link href="/contact" className="btn btn-lg btn-outline">
                Contact support
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* ---------- Downloads ---------- */}
      {state === 'paid' && (
      <section className="mt-10" aria-labelledby="downloads-heading">
        <h2 id="downloads-heading" className="headline text-2xl">
          Your downloads
        </h2>
        <ul className="mt-4 space-y-3">
          {order.items.map((item) => {
            const link = linkFor.get(String(item.product));
            return (
              <li key={item.product} className="flex flex-col gap-4 rounded-2xl border border-stone-200 bg-white p-4 sm:flex-row sm:flex-wrap sm:items-center">
                <div className="flex min-w-0 flex-1 items-center gap-4">
                  <div className="relative aspect-[4/3] w-20 shrink-0 overflow-hidden rounded-lg bg-stone-100">
                    {item.coverImage && (
                      <Image src={item.coverImage} alt="" fill sizes="80px" placeholder="blur" blurDataURL={NEUTRAL_BLUR_DATA_URL} className="object-cover" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <Link href={`/products/${item.slug}`} className="line-clamp-2 font-medium hover:underline">
                      {item.title}
                    </Link>
                    {link && (
                      <p className="mt-0.5 text-xs text-stone-500">
                        Re-download any time · link refreshes each time you open this page
                      </p>
                    )}
                  </div>
                </div>

                {link?.files?.length > 1 ? (
                  <FileDownloads files={link.files} />
                ) : link ? (
                  <a
                    href={link.url}
                    rel="noreferrer"
                    className="btn btn-md btn-primary shrink-0"
                  >
                    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.2">
                      <path d="M12 3v12m0 0-4-4m4 4 4-4M5 19h14" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    Download Digital Product
                  </a>
                ) : (
                  <span className="shrink-0 rounded-full bg-stone-100 px-4 py-2 text-sm text-stone-500">
                    Not available
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </section>
      )}

      {/* ---------- Receipt ---------- */}
      <section className="mt-10 rounded-2xl border border-stone-200 bg-white p-5 sm:p-6" aria-labelledby="receipt-heading">
        <h2 id="receipt-heading" className="headline text-2xl">
          {state === 'paid' ? 'Receipt' : 'Order summary'}
        </h2>
        <dl className="mt-4 grid grid-cols-1 gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
          <div className="flex justify-between gap-4">
            <dt className="text-stone-500">Order number</dt>
            <dd className="font-medium">#{orderNumber}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-stone-500">Date</dt>
            <dd className="font-medium">{placedAt}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-stone-500">Payment</dt>
            <dd className="font-medium">{paymentLabel}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-stone-500">Status</dt>
            <dd className={`font-medium ${state === 'paid' ? 'text-emerald-700' : state === 'failed' ? 'text-red-600' : 'text-amber-700'}`}>
              {state === 'paid' ? 'Paid' : state === 'failed' ? 'Not paid' : 'Awaiting payment'}
            </dd>
          </div>
          {order.charge?.transactionId && (
            <div className="flex justify-between gap-4">
              <dt className="text-stone-500">Transaction ID</dt>
              <dd className="font-medium break-all">{order.charge.transactionId}</dd>
            </div>
          )}
        </dl>

        <table className="mt-6 w-full text-sm">
          <caption className="sr-only">Items purchased</caption>
          <tbody className="divide-y divide-stone-100 border-y border-stone-200">
            {order.items.map((item) => (
              <tr key={item.product}>
                <th scope="row" className="py-3 pr-4 text-left font-normal break-words">
                  {item.title}
                </th>
                <td className="py-3 text-right font-medium">{item.price === 0 ? 'Free' : money(item.price)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="text-stone-600">
            {(order.feeAmount > 0 || order.taxAmount > 0) && (
              <tr>
                <th scope="row" className="pt-3 text-left font-normal">Subtotal</th>
                <td className="pt-3 text-right">{money(order.subtotal)}</td>
              </tr>
            )}
            {order.feeAmount > 0 && (
              <tr>
                <th scope="row" className="pt-1 text-left font-normal">Service fee</th>
                <td className="pt-1 text-right">{money(order.feeAmount)}</td>
              </tr>
            )}
            {order.taxAmount > 0 && (
              <tr>
                <th scope="row" className="pt-1 text-left font-normal">Tax</th>
                <td className="pt-1 text-right">{money(order.taxAmount)}</td>
              </tr>
            )}
            <tr className="text-base font-medium text-ink">
              <th scope="row" className="pt-3 text-left">{state === 'paid' ? 'Total paid' : 'Total'}</th>
              <td className="pt-3 text-right">{money(order.totalAmount)}</td>
            </tr>
            {order.charge?.currency === 'PKR' && order.charge.rate !== 1 && (
              <tr className="text-ink">
                <th scope="row" className="pt-1 text-left font-normal text-stone-600">
                  {state === 'paid' ? 'Charged' : 'To pay'} in rupees ($1 = Rs {order.charge.rate})
                </th>
                <td className="pt-1 text-right font-medium">{formatPkr(order.charge.amount)}</td>
              </tr>
            )}
          </tfoot>
        </table>
      </section>

      <p className="mt-8 text-center text-sm text-stone-500">
        <Link href="/products" className="font-medium text-ink underline-offset-2 hover:underline">
          Continue shopping →
        </Link>
      </p>
    </div>
  );
}
