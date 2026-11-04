import { authorizeAdminRequest } from '@/lib/auth';
import { errorResponse, json, readJson, unauthorized } from '@/lib/api';
import { getMarketplaceSettings, updateMarketplaceSettings } from '@/lib/data/settings';
import { moderateProducts } from '@/lib/data/product-moderation';
import { refreshStorefront } from '@/lib/revalidate';

/**
 * Admin marketplace settings (lib/data/settings.js).
 *   GET   → { autoApproveListings }
 *   PATCH { autoApproveListings, approvePending? } → saves; `approvePending: true` with auto-approve on also puts
 *         every listing still awaiting review live → { autoApproveListings, approved }
 */
export async function GET(request) {
  if (!(await authorizeAdminRequest(request))) return unauthorized('Admin access required.');
  try {
    return json(await getMarketplaceSettings());
  } catch (err) {
    return errorResponse(err, 'GET /api/admin/settings');
  }
}

export async function PATCH(request) {
  if (!(await authorizeAdminRequest(request))) return unauthorized('Admin access required.');
  try {
    const body = await readJson(request, 2 * 1024);
    const settings = await updateMarketplaceSettings(body);
    let approved = 0;
    if (settings.autoApproveListings && body.approvePending === true) {
      const result = await moderateProducts({ all: true, status: 'approved' });
      approved = result.updated;
      if (approved) refreshStorefront(...result.slugs);
    }
    return json({ ...settings, approved });
  } catch (err) {
    return errorResponse(err, 'PATCH /api/admin/settings');
  }
}
