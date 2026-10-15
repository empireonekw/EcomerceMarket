import Link from 'next/link';
import AuthCard from '@/components/auth/AuthCard';

export const metadata = { title: 'Forgot password', robots: { index: false } };

// Self-service reset needs an email provider to send reset links; until one is configured,
// this page explains what still works.
export default function ForgotPasswordPage() {
  return (
    <AuthCard
      title="Forgot your password?"
      subtitle="Email password resets are coming soon."
      footer={
        <Link href="/login" className="font-medium text-black hover:underline">
          Back to log in
        </Link>
      }
    >
      <div className="space-y-2 rounded-xl bg-stone-50 p-4 text-sm text-stone-700">
        <p>We’re setting up password reset by email. Until then, try logging in again — passwords are case-sensitive.</p>
        <p className="text-stone-500">Bought as a guest? Your private receipt link still gives you access to your downloads.</p>
      </div>
    </AuthCard>
  );
}
