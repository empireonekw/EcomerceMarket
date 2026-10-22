import Link from 'next/link';
import { notFound } from 'next/navigation';
import ProductForm from '@/components/dashboard/ProductForm';
import DeleteProductButton from '@/components/admin/DeleteProductButton';
import { PageHeader } from '@/components/dashboard/ui';
import { getAdminProduct } from '@/lib/data/admin';
import { getCategories } from '@/lib/data/categories';

export const metadata = { title: 'Edit Product' };

export default async function EditProductPage({ params }) {
  const { id } = await params;
  const [product, categories] = await Promise.all([getAdminProduct(id), getCategories()]);
  if (!product) notFound();

  return (
    <>
      <PageHeader
        title="Edit Product"
        description={`/products/${product.slug} · ${product.salesCount} sale${product.salesCount === 1 ? '' : 's'}`}
        actions={
          <>
            {product.isPublished && product.status === 'approved' && (
              <a
                href={`/products/${product.slug}`}
                target="_blank"
                rel="noopener"
                className="inline-flex h-8 items-center rounded-full px-3 text-sm font-medium text-stone-500 hover:bg-stone-100 hover:text-ink"
              >
                View in store ↗
              </a>
            )}
            <DeleteProductButton id={product._id} title={product.title} redirectTo="/admin/products" />
            <Link href="/admin/products" className="inline-flex h-8 items-center px-3 text-sm font-medium text-stone-500 hover:text-ink">
              ← Back
            </Link>
          </>
        }
      />
      {/* key: remount the form if navigating between two products' edit pages */}
      <ProductForm key={product._id} mode="edit" categories={categories} product={product} />
    </>
  );
}
