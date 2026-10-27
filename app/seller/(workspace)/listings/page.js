import ListingsManager from '@/components/seller/ListingsManager';
import { requireSellerStore } from '@/lib/auth';
import { getSellerListings, LISTING_SORT_KEYS, LISTING_STATUS_KEYS } from '@/lib/data/seller';

export const metadata = { title: 'Listings' };

/** Seller → Listings: every listing with search, status filters, sort, grid/list view and bulk actions. */
export default async function SellerListingsPage({ searchParams }) {
  const seller = await requireSellerStore('/seller/listings');
  const sp = await searchParams;
  const params = {
    status: LISTING_STATUS_KEYS.includes(sp.status) ? sp.status : 'all',
    q: typeof sp.q === 'string' ? sp.q.slice(0, 100) : '',
    sort: LISTING_SORT_KEYS.includes(sp.sort) ? sp.sort : 'newest',
    featured: sp.featured === '1' ? '1' : '',
    view: sp.view === 'list' ? 'list' : 'grid',
    stats: sp.stats === '0' ? '0' : '1',
    ...(sp.page && { page: sp.page }),
  };
  const data = await getSellerListings(seller.id, { ...params, featured: Boolean(params.featured) });

  return <ListingsManager items={data.items} counts={data.counts} total={data.total} pagination={data.pagination} params={params} />;
}
