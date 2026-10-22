import { AlertTriangle, CheckCircle2, Clock, DollarSign } from 'lucide-react';
import PayoutDetailsForm from '@/components/seller/PayoutDetailsForm';
import RequestPayoutButton from '@/components/seller/RequestPayoutButton';
import { PageHeader, Panel, StatCard, StatusBadge, formatDateTime } from '@/components/dashboard/ui';
import { requireSellerStore } from '@/lib/auth';
import { getSellerPayouts } from '@/lib/data/seller';
import { commissionPercent, COMMISSION_RATE } from '@/lib/commission';
import { formatPrice } from '@/lib/utils';

export const metadata = { title: 'Payouts & Bank Details' };

const usd = (cents) => formatPrice(cents, 'USD');

function payoutBlocker(data) {
  if (data.openRequest) return `Request for ${usd(data.openRequest.amount)} sent ${formatDateTime(data.openRequest.createdAt).date} — awaiting payment.`;
  if (data.balances.pendingPayout <= 0) return 'Your pending balance is empty.';
  if (!data.hasPayoutMethod) return 'Add bank or wallet details below first.';
  return null;
}

/** Seller → Payouts & Bank Details: balances, request a payout, payout history and where to send the money. */
export default async function SellerPayoutsPage() {
  const seller = await requireSellerStore('/seller/payouts');
  const data = await getSellerPayouts(seller.id);
  const blocker = payoutBlocker(data);

  return (
    <>
      <PageHeader
        title="Payouts & Bank Details"
        description={`You keep ${commissionPercent(1 - COMMISSION_RATE)} of every sale. Request a payout any time you have a balance — our team sends it to the details below.`}
      />

      {!data.hasPayoutMethod && (
        <div role="status" className="mb-8 flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <AlertTriangle size={20} strokeWidth={1.75} aria-hidden="true" className="mt-0.5 shrink-0 text-amber-600" />
          <div>
            <p className="font-medium text-amber-900">Add your payout details to get paid</p>
            <p className="mt-0.5 text-sm text-amber-800">Add a bank account or mobile wallet below so we can send your earnings.</p>
          </div>
        </div>
      )}

      <section aria-label="Balances" className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Pending Payout" value={usd(data.balances.pendingPayout)} sub="Earned, not yet paid out" icon={Clock} tone="warning" />
        <StatCard label="Completed Payouts" value={usd(data.balances.paidPayout)} sub="Sent to your account" icon={CheckCircle2} tone="info" />
        <StatCard label="Total Earnings" value={usd(data.balances.totalEarnings)} sub="Your share, all time" icon={DollarSign} tone="positive" />
      </section>

      <div className="mt-8 grid gap-6 xl:grid-cols-[1.4fr_1fr] xl:items-start">
        <Panel title="Payout details" id="details">
          <div className="p-5 sm:p-6">
            <PayoutDetailsForm initial={data.bankDetails} />
          </div>
        </Panel>

        <Panel title="Payouts" action={<span className="text-sm text-stone-500">Available: {usd(data.balances.pendingPayout)}</span>}>
          <div className="border-b border-stone-100 p-5">
            <RequestPayoutButton disabled={Boolean(blocker)} reason={blocker} />
          </div>
          {data.payouts.length === 0 ? (
            <p className="px-5 py-6 text-center text-sm text-stone-500">No payouts yet.</p>
          ) : (
            <ul className="divide-y divide-stone-100">
              {data.payouts.map((p) => (
                <li key={p._id} className="flex items-center justify-between gap-4 px-5 py-3 text-sm">
                  <div>
                    <p className="font-medium tabular-nums">{usd(p.amount)}</p>
                    <p className="text-xs text-stone-500">
                      {formatDateTime(p.paidAt ?? p.createdAt).date}
                      {p.reference && ` · Ref ${p.reference}`}
                    </p>
                  </div>
                  <StatusBadge status={p.status} />
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}
