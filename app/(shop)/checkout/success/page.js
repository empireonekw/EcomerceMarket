import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import CopyLinkButton from '@/components/CopyLinkButton';
import ClaimOrderButton from '@/components/ClaimOrderButton';
import { getOrderReceipt } from '@/lib/data/orders';
import { getCurrentUser } from '@/lib/auth';
import { formatPrice, NEUTRAL_BLUR_DATA_URL } from '@/lib/utils';

// Private, per-buyer page: never cache, never index, never leak the token via Referer.
export const metadata = {
  title: 'Your downloads',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

const PAYMENT_LABELS = { demo: 'Demo (no charge)', free: 'Free order' };

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

  return (
    <div className="container-page max-w-4xl py-10 sm:py-14">
      {/* ---------- Confirmation ---------- */}
      <header className="text-center">
        <span className="mx-auto grid size-14 place-items-center rounded-full bg-emerald-100 text-emerald-600">
          <svg aria-hidden="true" viewBox="0 0 24 24" className="size-7" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="m5 12 4.5 4.5L19 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
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
      </header>

      {/* ---------- Downloads ---------- */}
      <section className="mt-10" aria-labelledby="downloads-heading">
        <h2 id="downloads-heading" className="headline text-2xl">
          Your downloads
        </h2>
        <ul className="mt-4 space-y-3">
          {order.items.map((item) => {
            const link = linkFor.get(String(item.product));
            return (
              <li key={item.product} className="flex flex-col gap-4 rounded-2xl border border-stone-200 bg-white p-4 sm:flex-row sm:items-center">
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

                {link ? (
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

      {/* ---------- Receipt ---------- */}
      <section className="mt-10 rounded-2xl border border-stone-200 bg-white p-5 sm:p-6" aria-labelledby="receipt-heading">
        <h2 id="receipt-heading" className="headline text-2xl">
          Receipt
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
            <dd className="font-medium">{PAYMENT_LABELS[order.paymentProvider] ?? order.paymentProvider}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-stone-500">Status</dt>
            <dd className="font-medium capitalize text-emerald-700">{order.status}</dd>
          </div>
        </dl>

        <table className="mt-6 w-full text-sm">
          <caption className="sr-only">Items purchased</caption>
          <tbody className="divide-y divide-stone-100 border-y border-stone-200">
            {order.items.map((item) => (
              <tr key={item.product}>
                <th scope="row" className="py-2.5 pr-4 text-left font-normal break-words">
                  {item.title}
                </th>
                <td className="py-2.5 text-right font-medium">{item.price === 0 ? 'Free' : money(item.price)}</td>
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
              <th scope="row" className="pt-3 text-left">Total paid</th>
              <td className="pt-3 text-right">{money(order.totalAmount)}</td>
            </tr>
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
