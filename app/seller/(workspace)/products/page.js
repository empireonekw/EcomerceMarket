import Image from 'next/image';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import SellerProductActions from '@/components/seller/SellerProductActions';
import { PageHeader, StatusBadge, EmptyState, buttonClasses, formatDateTime } from '@/components/dashboard/ui';
import { requireSellerStore } from '@/lib/auth';
import { getSellerProducts } from '@/lib/data/seller';
import { formatPrice, NEUTRAL_BLUR_DATA_URL } from '@/lib/utils';

export const metadata = { title: 'My products' };

const usd = (cents) => formatPrice(cents, 'USD');

function statusOf(p) {
  if (p.status === 'approved') return p.isPublished ? { tone: 'approved', label: 'Live' } : { tone: 'cancelled', label: 'Hidden' };
  return { tone: p.status, label: { pending: 'In review', rejected: 'Rejected' }[p.status] };
}

/** Seller → My products: every listing with its status, sales and earnings; hide/show and delete. */
export default async function SellerProductsPage() {
  const seller = await requireSellerStore('/seller/products');
  const products = await getSellerProducts(seller.id);
  const live = products.filter((p) => p.status === 'approved' && p.isPublished).length;

  return (
    <>
      <PageHeader
        title="My products"
        description={`${products.length} product${products.length === 1 ? '' : 's'} · ${live} live in the store`}
        actions={
          <Link href="/seller/products/add" className={buttonClasses.primary}>
            <Plus size={16} strokeWidth={2} aria-hidden="true" />
            Add product
          </Link>
        }
      />

      {products.length === 0 ? (
        <EmptyState title="No products yet">
          <Link href="/seller/products/add" className="font-medium text-black underline underline-offset-2">
            Upload your first product
          </Link>{' '}
          — it goes live once approved.
        </EmptyState>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-stone-200 bg-stone-50 text-xs font-medium uppercase tracking-wide text-stone-500">
                <tr>
                  <th scope="col" className="px-5 py-3">Product</th>
                  <th scope="col" className="px-5 py-3">Status</th>
                  <th scope="col" className="px-5 py-3 text-right">Price</th>
                  <th scope="col" className="px-5 py-3 text-right">Sales</th>
                  <th scope="col" className="px-5 py-3 text-right">You earned</th>
                  <th scope="col" className="px-5 py-3 text-right">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {products.map((p) => {
                  const status = statusOf(p);
                  return (
                    <tr key={p._id} className="transition-colors hover:bg-stone-50/70">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <div className="relative aspect-[4/3] w-16 shrink-0 overflow-hidden rounded-lg bg-stone-100">
                            {p.coverImage && <Image src={p.coverImage} alt="" fill sizes="64px" placeholder="blur" blurDataURL={NEUTRAL_BLUR_DATA_URL} className="object-cover" />}
                          </div>
                          <div className="min-w-0">
                            {status.label === 'Live' ? (
                              <Link href={`/products/${p.slug}`} className="line-clamp-1 font-medium hover:underline">
                                {p.title}
                              </Link>
                            ) : (
                              <p className="line-clamp-1 font-medium">{p.title}</p>
                            )}
                            <p className="text-xs text-stone-500">Added {formatDateTime(p.createdAt).date}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <StatusBadge status={status.tone} label={status.label} />
                      </td>
                      <td className="px-5 py-3 text-right tabular-nums">{usd(p.price)}</td>
                      <td className="px-5 py-3 text-right tabular-nums">{p.salesCount.toLocaleString('en-US')}</td>
                      <td className="px-5 py-3 text-right font-medium tabular-nums">{usd(p.earnings)}</td>
                      <td className="px-5 py-3">
                        <SellerProductActions product={{ _id: p._id, title: p.title, status: p.status, isPublished: p.isPublished }} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
