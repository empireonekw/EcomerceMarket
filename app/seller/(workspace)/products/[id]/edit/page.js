import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Info } from 'lucide-react';
import ProductForm from '@/components/dashboard/ProductForm';
import { PageHeader, StatusBadge } from '@/components/dashboard/ui';
import { requireSellerStore } from '@/lib/auth';
import { getCategories } from '@/lib/data/categories';
import { getSellerProductForEdit } from '@/lib/data/seller';

export const metadata = { title: 'Edit product' };

const STATUS = { pending: 'In review', approved: 'Approved', rejected: 'Rejected' };

/** Seller edits one of their own products. Saving sends it back to review (and out of the store until approved). */
export default async function SellerEditProductPage({ params }) {
  const { id } = await params;
  const seller = await requireSellerStore(`/seller/products/${id}/edit`);
  const [product, categories] = await Promise.all([getSellerProductForEdit(seller.id, id), getCategories()]);
  if (!product) notFound();

  return (
    <>
      <PageHeader
        title="Edit product"
        description={`${product.title} · ${product.salesCount} sale${product.salesCount === 1 ? '' : 's'}`}
        actions={
          <Link href="/seller/products" className="text-sm font-medium text-stone-500 hover:text-ink">
            ← My products
          </Link>
        }
      />
      <div className="mb-6 flex items-start gap-3 rounded-2xl border border-stone-200 bg-white p-4 text-sm text-stone-700">
        <Info size={18} strokeWidth={1.75} aria-hidden="true" className="mt-0.5 shrink-0 text-brand-600" />
        <p>
          Current status: <StatusBadge status={product.status} label={STATUS[product.status]} />{' '}
          {product.status === 'rejected'
            ? 'Fix what needs changing and save — it goes back to our team for review.'
            : 'Saving sends this product back to our team for review. It’s hidden from the store until it’s approved again.'}
        </p>
      </div>
      {/* key: remount the form if navigating between two products' edit pages */}
      <ProductForm key={product._id} mode="edit" variant="seller" categories={categories} product={product} />
    </>
  );
}
