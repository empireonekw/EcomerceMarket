import Link from 'next/link';
import ProductForm from '@/components/dashboard/ProductForm';
import { PageHeader } from '@/components/dashboard/ui';
import { requireSellerStore } from '@/lib/auth';
import { getCategories } from '@/lib/data/categories';

export const metadata = { title: 'Add Product' };

export default async function SellerAddProductPage() {
  await requireSellerStore('/seller/products/add');
  const categories = await getCategories();

  return (
    <>
      <PageHeader
        title="Add a product"
        description="Upload a cover image and a link to your PDF. Our team reviews new products before they go live."
        actions={
          <Link href="/seller/dashboard" className="text-sm font-medium text-stone-500 hover:text-ink">
            Back to dashboard
          </Link>
        }
      />
      <ProductForm mode="create" variant="seller" categories={categories} />
    </>
  );
}
