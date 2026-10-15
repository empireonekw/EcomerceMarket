import Link from 'next/link';
import ProductForm from '@/components/dashboard/ProductForm';
import { PageHeader } from '@/components/dashboard/ui';
import { requireAdmin } from '@/lib/auth';
import { getCategories } from '@/lib/data/categories';

export const metadata = { title: 'Add New Product' };

export default async function AddProductPage() {
  await requireAdmin();
  const categories = await getCategories();

  return (
    <>
      <PageHeader
        title="Add New Product"
        description="Create a digital product. It goes live immediately if “Published” is on."
        actions={
          <Link href="/admin/products" className="text-sm font-medium text-stone-500 hover:text-ink">
            ← Back to products
          </Link>
        }
      />
      <ProductForm mode="create" categories={categories} />
    </>
  );
}
