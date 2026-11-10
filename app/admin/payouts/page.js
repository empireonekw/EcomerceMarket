import ClearPayoutButton from '@/components/admin/ClearPayoutButton';
import { StatusBadge, EmptyState, formatDateTime } from '@/components/dashboard/ui';
import { MetricCard } from '@/components/admin/analytics/KpiCard';
import { Avatar, Card, PageTitle, TABLE_HEAD } from '@/components/admin/ui';
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
    <dl className="space-y-2 text-xs">
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
      <PageTitle
        title="Seller Payouts"
        description={`${NO_PLATFORM_FEE ? 'No platform commission on seller sales' : `${commissionPercent()} platform commission on seller sales`} · payouts are sent by hand`}
      />

      <section aria-label="Marketplace totals" className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <MetricCard
          label="Pending payouts"
          value={usd(totals.pendingPayouts)}
          sub={`${queue.length} seller${queue.length === 1 ? '' : 's'} waiting to be paid`}
          tone="brand"
        />
        <MetricCard
          label="Platform sales"
          value={usd(totals.platformSales)}
          sub={totals.demoSales ? `${usd(totals.demoSales)} from demo orders` : `${usd(totals.platformOwned)} from platform-owned products`}
        />
        <MetricCard
          label="Commission earned"
          value={usd(totals.commission)}
          sub={NO_PLATFORM_FEE ? 'None charged now: sellers keep 100%' : `${commissionPercent()} of seller sales`}
        />
        <MetricCard
          label="Paid to sellers"
          value={usd(totals.paidPayouts)}
          sub={`${totals.sellerCount} registered seller${totals.sellerCount === 1 ? '' : 's'}`}
          tone="ink"
        />
      </section>

      {/* ---------- Clearing queue ---------- */}
      <div className="mt-4">
        <Card title="Pending balances" sub="Send the money, then mark it as paid" bodyClassName="px-3 pb-3 pt-3">
          {queue.length === 0 ? (
            <EmptyState title="All sellers are paid up">Balances appear here as sellers make sales.</EmptyState>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className={TABLE_HEAD}>
                  <tr>
                    <th scope="col" className="pl-3">
                      Seller
                    </th>
                    <th scope="col" className="px-3">
                      Send to
                    </th>
                    <th scope="col" className="px-3 text-right">
                      Pending
                    </th>
                    <th scope="col" className="px-3 text-right">
                      Paid to date
                    </th>
                    <th scope="col" className="pr-3 text-right">
                      <span className="sr-only">Action</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {queue.map((s) => (
                    <tr key={s.id} className="align-top">
                      <td className="py-4 pl-3">
                        <div className="flex items-start gap-3">
                          <Avatar name={s.storeName} />
                          <div className="min-w-0">
                            <p className="font-semibold text-ink">{s.storeName}</p>
                            <p className="text-xs text-stone-500">
                              {s.name} · {s.email}
                            </p>
                            {s.requestedAt && (
                              <div className="mt-2">
                                <StatusBadge status="requested" label={`Requested ${formatDateTime(s.requestedAt).date}`} />
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-4">
                        <Destination details={s.bankDetails} />
                      </td>
                      <td className="px-3 py-4 text-right text-base font-semibold tabular-nums text-ink">{usd(s.pendingPayout)}</td>
                      <td className="px-3 py-4 text-right tabular-nums text-stone-600">{usd(s.paidPayout)}</td>
                      <td className="py-4 pr-3 text-right">
                        <ClearPayoutButton sellerId={s.id} storeName={s.storeName} amount={s.pendingPayout} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      {/* ---------- History ---------- */}
      <div className="mt-4">
        <Card title="Recent payouts" bodyClassName="px-5 pb-3 pt-2">
          {recentPayouts.length === 0 ? (
            <p className="py-8 text-center text-sm text-stone-500">No payouts recorded yet.</p>
          ) : (
            <ul className="divide-y divide-stone-100">
              {recentPayouts.map((p) => {
                const { date, time } = formatDateTime(p.paidAt);
                return (
                  <li key={p._id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                    <div className="min-w-0">
                      <p className="font-semibold text-ink">{p.seller?.seller?.storeName ?? p.seller?.name ?? 'Former seller'}</p>
                      <p className="text-xs text-stone-500">
                        {date} {time}
                        {p.reference && ` · Ref ${p.reference}`}
                      </p>
                    </div>
                    <span className="font-semibold tabular-nums text-emerald-700">{usd(p.amount)}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
