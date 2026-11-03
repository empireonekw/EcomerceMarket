import { redirect } from 'next/navigation';
import { ONBOARDING_PATH } from '@/lib/seller-onboarding';

/** The old one-step shop setup: shops are now opened with the wizard (old links and bookmarks still work). */
export default function SellerOnboardingPage() {
  redirect(ONBOARDING_PATH);
}
