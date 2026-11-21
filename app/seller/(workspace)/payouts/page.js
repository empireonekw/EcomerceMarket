import Link from 'next/link';
import { AlertTriangle, CheckCircle2, Clock, DollarSign, ShieldCheck } from 'lucide-react';
import PayoutDetailsForm from '@/components/seller/PayoutDetailsForm';
import PayoutProgress from '@/components/seller/PayoutProgress';
import { PageHeader, Panel, StatCard, StatusBadge, formatDateTime } from '@/components/dashboard/ui';
import { requireSellerStore } from '@/lib/auth';
import { getSellerPayouts } from '@/lib/data/seller';
import { getBalanceTrend } from '@/lib/data/seller-analytics';
import { commissionPercent, COMMISSION_RATE, MIN_PAYOUT, NO_PLATFORM_FEE, PAYOUT_FEE_LABEL } from '@/lib/commission';
import { formatPrice } from '@/lib/utils';

export const metadata = { title: 'Payouts & Bank Details' };

const usd = (cents) => formatPrice(cents, 'USD');

/** Seller → Payouts & Bank Details: balances, request a payout, payout history and where to send the money. */
export default async function SellerPayoutsPage() {
  const seller = await requireSellerStore('/seller/payouts');
  const data = await getSellerPayouts(seller.id);
  const trend = await getBalanceTrend(seller.id, data.balances.pendingPayout);

  return (
    <>
      <PageHeader
        title="Payouts & Bank Details"
        description={`${NO_PLATFORM_FEE ? 'No platform fees on sales.' : `You keep ${commissionPercent(1 - COMMISSION_RATE)} of every sale.`} A ${PAYOUT_FEE_LABEL} merchant fee is deducted only when you withdraw. Request a payout once your balance reaches ${usd(MIN_PAYOUT)}, and our team sends it to the details below.`}
      />

      {/* Identity is only asked for after the first sale (or once they've started it). */}
      {data.verification !== 'verified' && (data.verificationRequested || data.verification) && (
        <div role="status" className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-sky-200 bg-sky-50 p-5">
          <ShieldCheck size={20} strokeWidth={1.75} aria-hidden="true" className="shrink-0 text-sky-700" />
          <div className="min-w-0 flex-1">
            <p className="font-medium text-sky-950">{data.verification === 'pending' ? 'We’re checking your identity' : 'Verify your identity to get paid'}</p>
            <p className="mt-0.5 text-sm text-sky-900">
              {data.verification === 'pending'
                ? 'It usually takes a day or two. You can request a payout once it’s verified.'
                : 'A photo of both sides of your ID card and a quick selfie. It takes about two minutes.'}
            </p>
          </div>
          {data.verification !== 'pending' && (
            <Link href="/seller/verify" className="btn btn-md btn-dark shrink-0">
              Verify identity
            </Link>
          )}
        </div>
      )}

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

      <div className="mt-8 grid grid-cols-1 gap-6 xl:grid-cols-[1.4fr_1fr] xl:items-start">
        <Panel title="Payout details" id="details">
          <div className="p-5 sm:p-6">
            <PayoutDetailsForm initial={data.bankDetails} />
          </div>
        </Panel>

        {/* Right column: the $50 payout threshold (and Request payout) above the payout history. */}
        <div className="grid min-w-0 gap-6">
          <PayoutProgress
            balance={data.balances.pendingPayout}
            trend={trend}
            openRequest={data.openRequest}
            verification={data.verification}
            hasPayoutMethod={data.hasPayoutMethod}
          />

          <Panel title="Payouts" action={<span className="text-sm text-stone-500">Available: {usd(data.balances.pendingPayout)}</span>}>
            {data.payouts.length === 0 ? (
              <p className="px-5 py-6 text-center text-sm text-stone-500">No payouts yet.</p>
            ) : (
              <ul className="divide-y divide-stone-100">
                {data.payouts.map((p) => (
                  <li key={p._id} className="flex items-center justify-between gap-4 px-5 py-3 text-sm">
                    <div>
                      <p className="font-medium tabular-nums">{usd(p.fee > 0 ? (p.netAmount ?? p.amount - p.fee) : p.amount)}</p>
                      <p className="text-xs text-stone-500">
                        {formatDateTime(p.paidAt ?? p.createdAt).date}
                        {p.fee > 0 && ` · ${usd(p.amount)} withdrawn − ${usd(p.fee)} merchant fee`}
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
      </div>

      {/* The rules behind this page, linked where sellers handle money (payment providers check for this too). */}
      <p className="mt-8 text-sm leading-relaxed text-stone-500">
        Payouts follow our{' '}
        <Link href="/legal/payout-policy" target="_blank" className="font-medium text-stone-700 underline underline-offset-2 hover:text-ink">
          Payout Policy
        </Link>{' '}
        and{' '}
        <Link href="/legal/seller-agreement" target="_blank" className="font-medium text-stone-700 underline underline-offset-2 hover:text-ink">
          Seller Agreement
        </Link>
        : the {usd(MIN_PAYOUT)} minimum, the {PAYOUT_FEE_LABEL} merchant fee on each withdrawal, identity checks, timing, holds, and how
        refunds and chargebacks are reversed. Your payout details are
        handled as described in our{' '}
        <Link href="/privacy" target="_blank" className="font-medium text-stone-700 underline underline-offset-2 hover:text-ink">
          Privacy Policy
        </Link>
        .
      </p>
    </>
  );
}
