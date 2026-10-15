import Link from 'next/link';
import { redirect } from 'next/navigation';
import AuthCard from '@/components/auth/AuthCard';
import SignupForm from '@/components/auth/SignupForm';
import { getCurrentUser } from '@/lib/auth';
import { safeNext } from '@/lib/redirects';

export const metadata = { title: 'Create your account', robots: { index: false } };

export default async function SignupPage({ searchParams }) {
  const next = safeNext((await searchParams).next);
  if (await getCurrentUser()) redirect(next ?? '/profile');

  return (
    <AuthCard
      wide
      title="Create your account"
      subtitle="Buy, download and sell digital goods in one place."
      footer={
        <p>
          Already have an account?{' '}
          <Link href={next ? `/login?next=${encodeURIComponent(next)}` : '/login'} className="font-medium text-black hover:underline">
            Log in
          </Link>
        </p>
      }
    >
      <SignupForm next={next} />
    </AuthCard>
  );
}
