import ListingForm from '@/components/seller/ListingForm';
import { requireSellerStore } from '@/lib/auth';
import { getCategories } from '@/lib/data/categories';
import { getMarketplaceSettings } from '@/lib/data/settings';
import { getRecentListingCategories } from '@/lib/data/seller';
import { uploadDriver } from '@/lib/uploads';

export const metadata = { title: 'New listing' };

export default async function NewListingPage() {
  const seller = await requireSellerStore('/seller/listings/new');
  const [categories, settings, recentCategories] = await Promise.all([getCategories(), getMarketplaceSettings(), getRecentListingCategories(seller.id)]);
  return <ListingForm categories={categories} recentCategories={recentCategories} uploads={uploadDriver()} autoApprove={settings.autoApproveListings} />;
}
