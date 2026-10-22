import Link from 'next/link';
import { redirect } from 'next/navigation';
import AuthCard from '@/components/auth/AuthCard';
import LoginForm from '@/components/auth/LoginForm';
import { getCurrentUser } from '@/lib/auth';
import { safeNext } from '@/lib/redirects';
import { siteConfig } from '@/lib/site';

export const metadata = { title: 'Log in', robots: { index: false } };

const DASHBOARD = { admin: '/admin', seller: '/seller/dashboard', customer: '/' };

export default async function LoginPage({ searchParams }) {
  const params = await searchParams;
  const next = safeNext(params.next);
  // '1' = new customer, 'seller' = new seller (see SignupForm)
  const registered = ['1', 'seller'].includes(params.registered) ? params.registered : false;
  const user = await getCurrentUser();

  // Signed in but sent here from /admin without admin rights: explain instead of looping back.
  if (user && next?.startsWith('/admin') && user.role !== 'admin') {
    return (
      <AuthCard title="Admin access required" subtitle={`You’re signed in as ${user.email}, which doesn’t have admin access.`}>
        <div className="flex flex-col gap-3">
          <Link href={DASHBOARD[user.role]} className="btn btn-md btn-dark w-full">
            Go to my account
          </Link>
          <form action="/api/auth/logout" method="post">
            <button type="submit" className="btn btn-md w-full text-stone-600 hover:bg-stone-100">
              Log in with a different account
            </button>
          </form>
        </div>
      </AuthCard>
    );
  }
  if (user) redirect(next ?? DASHBOARD[user.role]);

  const signupHref = next ? `/signup?next=${encodeURIComponent(next)}` : '/signup';
  const intro =
    registered === 'seller'
      ? { title: 'Your seller account is ready', subtitle: 'Log in to set up your shop — it only takes a minute.' }
      : registered
        ? { title: 'Welcome aboard', subtitle: `Log in to start shopping on ${siteConfig.name}.` }
        : {
            title: 'Welcome back',
            subtitle: next?.startsWith('/admin') ? 'Log in with your admin account.' : `Log in to your ${siteConfig.name} account.`,
          };
  return (
    <AuthCard
      title={intro.title}
      subtitle={intro.subtitle}
      footer={
        <p>
          New to {siteConfig.name}?{' '}
          <Link href={signupHref} className="font-medium text-black hover:underline">
            Create an account
          </Link>
        </p>
      }
    >
      <LoginForm next={next} registered={registered} />
    </AuthCard>
  );
}
