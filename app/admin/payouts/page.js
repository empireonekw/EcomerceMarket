import { BadgePercent, Clock, DollarSign, Users } from 'lucide-react';
import ClearPayoutButton from '@/components/admin/ClearPayoutButton';
import { PageHeader, Panel, StatCard, StatusBadge, EmptyState, formatDateTime } from '@/components/dashboard/ui';
import { getPayoutOverview } from '@/lib/data/payouts';
import { commissionPercent, NO_PLATFORM_FEE } from '@/lib/commission';
import { WALLET_OPTIONS } from '@/lib/validation';
import { formatPrice } from '@/lib/utils';

export const metadata = { title: 'Seller Payouts' };

const usd = (cents) => formatPrice(cents, 'USD');
const walletLabel = (value) => WALLET_OPTIONS.find((w) => w.value === value)?.label ?? value;

/** Where to send the money — bank and/or wallet, exactly as the seller saved it. */
function Destination({ details }) {
  const hasBank = details.accountNumber;
  const hasWallet = details.walletNumber;
  if (!hasBank && !hasWallet) return <span className="text-xs font-medium text-red-600">No payout details on file</span>;
  return (
    <dl className="space-y-1.5 text-xs">
      {hasBank && (
        <div>
          <dt className="font-medium text-stone-700">{details.bankName}</dt>
          <dd className="text-stone-600">{details.accountTitle}</dd>
          <dd className="font-mono text-stone-800">{details.accountNumber}</dd>
        </div>
      )}
      {hasWallet && (
        <div>
          <dt className="font-medium text-stone-700">{walletLabel(details.walletProvider)}</dt>
          <dd className="font-mono text-stone-800">{details.walletNumber}</dd>
        </div>
      )}
    </dl>
  );
}

export default async function AdminPayoutsPage() {
  const { totals, queue, recentPayouts } = await getPayoutOverview();

  return (
    <>
      <PageHeader title="Seller Payouts" description={`${NO_PLATFORM_FEE ? 'No platform commission on seller sales' : `${commissionPercent()} platform commission on seller sales`} · payouts are sent manually`} />

      <section aria-label="Marketplace totals" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total Platform Sales"
          value={usd(totals.platformSales)}
          sub={totals.demoSales ? `${usd(totals.demoSales)} from demo orders` : `${usd(totals.platformOwned)} from platform-owned products`}
          icon={DollarSign}
          tone="positive"
        />
        <StatCard label="Admin Commission Earned" value={usd(totals.commission)} sub={NO_PLATFORM_FEE ? 'From earlier sales — no commission is charged now' : `${commissionPercent()} of seller sales`} icon={BadgePercent} tone="info" />
        <StatCard label="Pending Seller Payouts" value={usd(totals.pendingPayouts)} sub={`${queue.length} seller${queue.length === 1 ? '' : 's'} awaiting payment`} icon={Clock} tone="warning" />
        <StatCard label="Paid to Sellers" value={usd(totals.paidPayouts)} sub={`${totals.sellerCount} registered seller${totals.sellerCount === 1 ? '' : 's'}`} icon={Users} />
      </section>

      {/* ---------- Clearing queue ---------- */}
      <div className="mt-8">
        <Panel title="Pending balances">
          {queue.length === 0 ? (
            <div className="p-5">
              <EmptyState title="All sellers are paid up">Balances appear here as sellers make sales.</EmptyState>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="border-b border-stone-200 bg-stone-50 text-xs font-medium uppercase tracking-wide text-stone-500">
                  <tr>
                    <th scope="col" className="px-5 py-3">Seller</th>
                    <th scope="col" className="px-5 py-3">Send to</th>
                    <th scope="col" className="px-5 py-3 text-right">Pending</th>
                    <th scope="col" className="px-5 py-3 text-right">Paid to date</th>
                    <th scope="col" className="px-5 py-3 text-right">
                      <span className="sr-only">Action</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {queue.map((s) => (
                    <tr key={s.id} className="align-top">
                      <td className="px-5 py-4">
                        <p className="font-medium">{s.storeName}</p>
                        <p className="text-xs text-stone-500">
                          {s.name} · {s.email}
                        </p>
                        {s.requestedAt && (
                          <div className="mt-1.5">
                            <StatusBadge status="requested" label={`Requested ${formatDateTime(s.requestedAt).date}`} />
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <Destination details={s.bankDetails} />
                      </td>
                      <td className="px-5 py-4 text-right text-base font-medium tabular-nums">{usd(s.pendingPayout)}</td>
                      <td className="px-5 py-4 text-right tabular-nums text-stone-600">{usd(s.paidPayout)}</td>
                      <td className="px-5 py-4 text-right">
                        <ClearPayoutButton sellerId={s.id} storeName={s.storeName} amount={s.pendingPayout} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>

      {/* ---------- History ---------- */}
      <div className="mt-8">
        <Panel title="Recent payouts">
          {recentPayouts.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-stone-500">No payouts recorded yet.</p>
          ) : (
            <ul className="divide-y divide-stone-100">
              {recentPayouts.map((p) => {
                const { date, time } = formatDateTime(p.paidAt);
                return (
                  <li key={p._id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm">
                    <div className="min-w-0">
                      <p className="font-medium">{p.seller?.seller?.storeName ?? p.seller?.name ?? 'Former seller'}</p>
                      <p className="text-xs text-stone-500">
                        {date} {time}
                        {p.reference && ` · Ref ${p.reference}`}
                      </p>
                    </div>
                    <span className="font-medium tabular-nums">{usd(p.amount)}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}
