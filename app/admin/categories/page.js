import CategoryManager from '@/components/admin/CategoryManager';
import { PageHeader } from '@/components/dashboard/ui';
import { getAdminCategories } from '@/lib/data/admin-categories';

export const metadata = { title: 'Categories' };

/** Admin → Categories: add, edit, nest (main › sub › inner) and delete product categories. */
export default async function AdminCategoriesPage() {
  const categories = await getAdminCategories();
  return (
    <>
      <PageHeader title="Categories" description="Organise products into main categories, sub-categories and inner categories. Main categories appear in the Shop menu." />
      <CategoryManager categories={categories} />
    </>
  );
}
