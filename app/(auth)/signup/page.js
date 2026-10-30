import { Suspense } from 'react';
import { SignupFromUrl, SignupView } from '@/components/auth/AuthViews';

export const metadata = { title: 'Create your account', robots: { index: false } };

/** Static, so links to it open instantly from the prefetch cache; ?next= and signed-in visitors are handled in components/auth/AuthViews.jsx. */
export default function SignupPage() {
  return (
    <Suspense fallback={<SignupView />}>
      <SignupFromUrl />
    </Suspense>
  );
}
