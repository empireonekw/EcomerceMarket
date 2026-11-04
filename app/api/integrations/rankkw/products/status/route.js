import mongoose from 'mongoose';
import { json, unauthorized, readJson, errorResponse } from '@/lib/api';
import { connectDB } from '@/lib/mongodb';
import { listingStatus } from '@/lib/listing';
import { rankkwSeller } from '@/lib/rankkw-link';
import { siteConfig } from '@/lib/site';
import Product from '@/models/Product';

/**
 * POST /api/integrations/rankkw/products/status { ids } (Bearer) — which of these listings still exist in the
 * seller's shop: { products: [{ id, slug, status, url, editUrl }] }. A listing deleted here is simply not in the list,
 * so Rankkw shows its Etsy listing as not on Sellpify again. `status` is listingStatus(): active, inactive, review,
 * draft or rejected.
 */
export async function POST(request) {
  const seller = await rankkwSeller(request);
  if (!seller) return unauthorized('Not connected.');
  try {
    const { ids } = await readJson(request, 32 * 1024);
    const valid = [...new Set((Array.isArray(ids) ? ids : []).map(String))].filter((id) => mongoose.isValidObjectId(id)).slice(0, 1000);
    if (!valid.length) return json({ products: [] });
    await connectDB();
    const products = await Product.find({ _id: { $in: valid }, sellerId: seller.id }).select('slug status isPublished').lean();
    return json({
      products: products.map((p) => ({
        id: String(p._id),
        slug: p.slug,
        status: listingStatus(p).key,
        url: `${siteConfig.url}/products/${p.slug}`,
        editUrl: `${siteConfig.url}/seller/listings/${p._id}/edit`,
      })),
    });
  } catch (err) {
    return errorResponse(err, 'POST /api/integrations/rankkw/products/status');
  }
}
