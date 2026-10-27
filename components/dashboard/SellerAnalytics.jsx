import { Banknote, CircleDollarSign, LogIn, Package, Store, UserPlus, Wallet } from 'lucide-react';
import EarningsChart from '@/components/dashboard/EarningsChart';
import PagedList from '@/components/dashboard/PagedList';
import { Panel, formatDateTime } from '@/components/dashboard/ui';
import { formatPrice } from '@/lib/utils';

// Server-rendered seller analytics, shared by Admin → Users → [seller] and the seller's own workspace.

const usd = (cents) => formatPrice(cents, 'USD');
const cell = (cents) => (cents ? usd(cents) : <span className="text-stone-300">—</span>);

/** Monthly earnings chart + the same numbers as a table (accessible view; newest month first). */
export function EarningsPanel({ months, title = 'Monthly earnings' }) {
  const total = months.reduce((s, m) => s + m.earnings, 0);
  const sales = months.reduce((s, m) => s + m.sales, 0);
  const showFees = months.some((m) => m.commission > 0); // no platform fee now; only older sales may have one
  return (
    <Panel
      title={title}
      action={
        <span className="text-sm text-stone-500 tabular-nums">
          {usd(total)} · {sales} sale{sales === 1 ? '' : 's'} in {months.length} months
        </span>
      }
    >
      <EarningsChart months={months} title={title} />
      <details className="group/table border-t border-stone-100">
        <summary className="cursor-pointer list-none px-5 py-3 text-sm font-medium text-stone-600 hover:text-black [&::-webkit-details-marker]:hidden">
          <span className="group-open/table:hidden">View as table</span>
          <span className="hidden group-open/table:inline">Hide table</span>
        </summary>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead className="border-y border-stone-200 bg-stone-50 text-xs font-medium uppercase tracking-wide text-stone-500">
              <tr>
                <th scope="col" className="px-5 py-2.5">Month</th>
                <th scope="col" className="px-5 py-2.5 text-right">Sales</th>
                <th scope="col" className="px-5 py-2.5 text-right">Gross</th>
                {showFees && <th scope="col" className="px-5 py-2.5 text-right">Platform fee</th>}
                <th scope="col" className="px-5 py-2.5 text-right">Earnings</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 tabular-nums">
              {[...months].reverse().map((m) => (
                <tr key={m.month}>
                  <th scope="row" className="px-5 py-2.5 font-normal text-stone-700">{m.label}</th>
                  <td className="px-5 py-2.5 text-right">{m.sales || <span className="text-stone-300">—</span>}</td>
                  <td className="px-5 py-2.5 text-right">{cell(m.gross)}</td>
                  {showFees && <td className="px-5 py-2.5 text-right text-stone-500">{cell(m.commission)}</td>}
                  <td className="px-5 py-2.5 text-right font-medium">{cell(m.earnings)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </Panel>
  );
}

/** Seller earnings per product per month — which items earn what, and when. */
export function ProductMonthlyPanel({ data }) {
  return (
    <Panel title="Earnings by product" action={<span className="text-sm text-stone-500">Last {data.months.length} months</span>}>
      {data.rows.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-stone-500">No sales in this period yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-stone-200 bg-stone-50 text-xs font-medium uppercase tracking-wide text-stone-500">
              <tr>
                <th scope="col" className="px-5 py-2.5">Product</th>
                {data.months.map((m) => (
                  <th key={m.month} scope="col" className="whitespace-nowrap px-3 py-2.5 text-right">
                    {m.label}
                  </th>
                ))}
                <th scope="col" className="px-5 py-2.5 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 tabular-nums">
              {data.rows.map((r) => (
                <tr key={r.productId}>
                  <th scope="row" className="max-w-[16rem] px-5 py-2.5 font-normal">
                    <span className="block truncate font-medium text-black">{r.title}</span>
                    <span className="text-xs text-stone-500">
                      {r.sales} sale{r.sales === 1 ? '' : 's'}
                    </span>
                  </th>
                  {data.months.map((m) => (
                    <td key={m.month} className="whitespace-nowrap px-3 py-2.5 text-right">
                      {cell(r.cells[m.month])}
                    </td>
                  ))}
                  <td className="whitespace-nowrap px-5 py-2.5 text-right font-medium">{usd(r.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

const EVENT_ICONS = { account: UserPlus, shop: Store, login: LogIn, product: Package, sale: CircleDollarSign, payout: Wallet, paid: Banknote };
const EVENT_TONES = { sale: 'bg-emerald-50 text-emerald-700', paid: 'bg-brand-50 text-brand-700', payout: 'bg-amber-50 text-amber-700' };

/** Timeline of what the seller did and what happened to their account, newest first. */
export function ActivityLog({ events }) {
  return (
    <Panel title="Activity log" action={<span className="text-sm text-stone-500">Latest {events.length} events</span>}>
      {events.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-stone-500">No activity yet.</p>
      ) : (
        <PagedList pageSize={8} label="Activity" className="px-5 py-4">
          {events.map((e, i) => {
            const Icon = EVENT_ICONS[e.type] ?? Package;
            const { date, time } = formatDateTime(e.at);
            return (
              <li key={`${e.type}-${e.at}-${i}`} className="group/event relative flex gap-3 pb-5 last:pb-0">
                <span aria-hidden="true" className="absolute left-4 top-9 h-[calc(100%-2.25rem)] w-px bg-stone-200 group-last/event:hidden" />
                <span className={`grid size-8 shrink-0 place-items-center rounded-full ${EVENT_TONES[e.type] ?? 'bg-stone-100 text-stone-600'}`}>
                  <Icon size={15} strokeWidth={1.75} aria-hidden="true" />
                </span>
                <div className="min-w-0 pt-1">
                  <p className="text-sm text-black">{e.text}</p>
                  <p className="mt-0.5 text-xs text-stone-500">
                    {date} · {time}
                    {e.note && ` · ${e.note}`}
                  </p>
                </div>
              </li>
            );
          })}
        </PagedList>
      )}
    </Panel>
  );
}
