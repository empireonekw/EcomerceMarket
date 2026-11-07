'use client';

import { useId } from 'react';
import { CalendarDays } from 'lucide-react';
import { FilterTabs, usePendingNav } from '@/components/dashboard/PendingNav';

const field = 'h-10 rounded-full border border-stone-300 bg-white px-4 text-sm tabular-nums focus:border-black focus:outline-none';

/**
 * Admin → Users sign-up filter: Any time / Today / Yesterday, or a custom date range (from–to, inclusive).
 * `base` = the other filters to keep (role, q). Dates are calendar days in the marketplace timezone.
 */
export default function JoinedFilter({ base, joined, from, to, counts, today }) {
  const { navigate } = usePendingNav();
  const fromId = useId();
  const toId = useId();

  const href = (extra) => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...base, ...extra })) if (v) qs.set(k, v);
    const s = qs.toString();
    return s ? `/admin/users?${s}` : '/admin/users';
  };
  const active = joined === 'today' || joined === 'yesterday' ? joined : from || to ? 'range' : '';

  function applyRange(e) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    let [start, end] = [data.get('from') || '', data.get('to') || ''];
    if (start && end && start > end) [start, end] = [end, start]; // picked backwards: swap
    navigate(href({ from: start, to: end }));
  }

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
      <FilterTabs
        label="Filter by sign-up date"
        activeKey={active}
        items={[
          { key: '', label: 'Any time', href: href({}) },
          { key: 'today', label: 'Today', count: counts.today, href: href({ joined: 'today' }) },
          { key: 'yesterday', label: 'Yesterday', count: counts.yesterday, href: href({ joined: 'yesterday' }) },
          ...(active === 'range' ? [{ key: 'range', label: 'Custom range', href: href({ from, to }) }] : []),
        ]}
      />
      <form key={`${from}-${to}`} action="/admin/users" onSubmit={applyRange} className="flex flex-wrap items-center gap-2">
        {Object.entries(base).map(([k, v]) => v && <input key={k} type="hidden" name={k} value={v} />)}
        <CalendarDays size={17} strokeWidth={1.75} aria-hidden="true" className="hidden text-stone-400 sm:block" />
        <label htmlFor={fromId} className="sr-only">
          Joined from
        </label>
        <input id={fromId} name="from" type="date" defaultValue={from} max={today} className={field} />
        <span className="text-sm text-stone-400">to</span>
        <label htmlFor={toId} className="sr-only">
          Joined until
        </label>
        <input id={toId} name="to" type="date" defaultValue={to} max={today} className={field} />
        <button type="submit" className="btn btn-sm btn-outline h-10">
          Apply
        </button>
      </form>
    </div>
  );
}
