import { siteConfig } from '@/lib/site';

export const metadata = {
  title: { default: 'Seller', template: `%s · ${siteConfig.name} Seller` },
  robots: { index: false, follow: false },
};

/**
 * /seller/* — two areas:
 *  - onboarding/   shop setup for sellers who haven't named their shop yet (own, focused layout)
 *  - (workspace)/  dashboard + products inside the sidebar shell; requires a finished shop
 */
export default function SellerLayout({ children }) {
  return children;
}
