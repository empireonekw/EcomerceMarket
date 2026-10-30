'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import AuthCard from '@/components/auth/AuthCard';
import AuthSkeleton from '@/components/auth/AuthSkeleton';
import LoginForm from '@/components/auth/LoginForm';
import SignupForm from '@/components/auth/SignupForm';
import SwitchToSellerButton from '@/components/seller/SwitchToSellerButton';
import { hasAuthHint, useAuth } from '@/context/AuthContext';
import { safeNext } from '@/lib/redirects';
import { siteConfig } from '@/lib/site';

/*
 * The login and sign-up pages are static, so a click on "Log in" / "Sign up" / "Sell With Us" opens them from the
 * prefetch cache with no server round trip. What used to be decided on the server per request is done here:
 * the ?next= / ?registered= values come from the URL, and visitors who are already signed in are sent on.
 * Each page renders its plain version as the Suspense fallback (that is the static HTML) and the URL-aware version
 * once the browser has the search params.
 */

const DASHBOARD = { admin: '/admin', seller: '/seller/dashboard', customer: '/' };

/**
 * Who was signed in when the page opened: undefined while checking, null when signed out. Fixed at arrival, so
 * signing in on this very page doesn't count (LoginForm navigates on its own). Only visitors with the auth hint
 * cookie ever wait for the check; everyone else sees the form straight away.
 */
function useArrivalUser() {
  const { user, loading } = useAuth();
  const [hint, setHint] = useState(false);
  const [arrival, setArrival] = useState(undefined);
  useEffect(() => setHint(hasAuthHint()), []);
  useEffect(() => {
    if (!loading && arrival === undefined) setArrival(user ?? null);
  }, [loading, user, arrival]);
  return { arrival, checking: hint && arrival === undefined };
}

/** Sends a signed-in visitor on with replace (no back-button loop); shows the skeleton meanwhile. */
function Redirect({ to }) {
  const router = useRouter();
  useEffect(() => {
    router.replace(to);
  }, [router, to]);
  return <AuthSkeleton />;
}

/* ---------------------------------- /login ---------------------------------- */

export function LoginFromUrl() {
  const params = useSearchParams();
  const registered = ['1', 'seller'].includes(params.get('registered')) ? params.get('registered') : false;
  return <LoginView next={safeNext(params.get('next'))} registered={registered} />;
}

export function LoginView({ next, registered = false }) {
  const { arrival, checking } = useArrivalUser();
  const { logout } = useAuth();
  if (checking) return <AuthSkeleton />;

  if (arrival) {
    // Signed in, but sent here from /admin without admin rights: explain instead of looping back.
    if (next?.startsWith('/admin') && arrival.role !== 'admin') {
      return (
        <AuthCard title="Admin access required" subtitle={`You’re signed in as ${arrival.email}, which doesn’t have admin access.`}>
          <div className="flex flex-col gap-3">
            <Link href={DASHBOARD[arrival.role] ?? '/'} className="btn btn-md btn-dark w-full">
              Go to my account
            </Link>
            <button type="button" onClick={() => logout({ redirectTo: `/login?next=${encodeURIComponent(next)}` })} className="btn btn-md w-full text-stone-600 hover:bg-stone-100">
              Log in with a different account
            </button>
          </div>
        </AuthCard>
      );
    }
    return <Redirect to={next ?? DASHBOARD[arrival.role] ?? '/'} />;
  }

  const signupHref = next ? `/signup?next=${encodeURIComponent(next)}` : '/signup';
  const intro =
    registered === 'seller'
      ? { title: 'Your seller account is ready', subtitle: 'Log in to set up your shop. It only takes a minute.' }
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
          <Link href={signupHref} prefetch className="font-medium text-black hover:underline">
            Create an account
          </Link>
        </p>
      }
    >
      <LoginForm next={next} registered={registered} />
    </AuthCard>
  );
}

/* ---------------------------------- /signup --------------------------------- */

export function SignupFromUrl() {
  return <SignupView next={safeNext(useSearchParams().get('next'))} />;
}

export function SignupView({ next }) {
  const { arrival, checking } = useArrivalUser();
  if (checking) return <AuthSkeleton />;
  if (arrival) return <Redirect to={next ?? '/profile'} />;

  return (
    <AuthCard
      wide
      title="Create your account"
      subtitle="Buy, download and sell digital goods in one place."
      footer={
        <p>
          Already have an account?{' '}
          <Link href={next ? `/login?next=${encodeURIComponent(next)}` : '/login'} prefetch className="font-medium text-black hover:underline">
            Log in
          </Link>
        </p>
      }
    >
      <SignupForm next={next} />
    </AuthCard>
  );
}

/* ------------------------------- /sell/signup ------------------------------- */

/** Seller sign-up for visitors; sellers go to their workspace, other signed-in accounts get an explanation. */
export function SellerSignupGate({ children }) {
  const { arrival, checking } = useArrivalUser();
  if (checking) return <AuthSkeleton />;
  if (arrival?.role === 'seller') return <Redirect to="/seller/dashboard" />;
  if (!arrival) return children;

  const isAdmin = arrival.role === 'admin';
  return (
    <AuthCard
      title={isAdmin ? 'You’re signed in as an admin' : 'Selling needs a seller account'}
      subtitle={
        isAdmin
          ? 'Admin accounts manage the marketplace and can’t open a store.'
          : `You’re signed in as ${arrival.email}, a shopping account. Seller accounts are separate, so your purchases and your shop never mix. Create one with a different email.`
      }
    >
      {isAdmin ? (
        <Link href="/admin/payouts" className="btn btn-lg btn-dark w-full">
          Go to seller payouts
        </Link>
      ) : (
        <div className="space-y-2">
          <SwitchToSellerButton className="btn btn-lg btn-primary w-full" />
          <Link href="/products" className="btn btn-lg btn-outline w-full">
            Keep shopping
          </Link>
        </div>
      )}
    </AuthCard>
  );
}
