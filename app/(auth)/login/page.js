import { Suspense } from 'react';
import { LoginFromUrl, LoginView } from '@/components/auth/AuthViews';

export const metadata = { title: 'Log in', robots: { index: false } };

/** Static, so links to it open instantly from the prefetch cache; ?next= and signed-in visitors are handled in components/auth/AuthViews.jsx. */
export default function LoginPage() {
  return (
    <Suspense fallback={<LoginView />}>
      <LoginFromUrl />
    </Suspense>
  );
}
