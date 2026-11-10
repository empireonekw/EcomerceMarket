import Link from 'next/link';
import AuthCard from '@/components/auth/AuthCard';
import ForgotPasswordForm from '@/components/auth/ForgotPasswordForm';

export const metadata = { title: 'Forgot password', robots: { index: false } };

/** "Forgot password?" from the login form: a 6-digit code by email, then a new password (components/auth/ForgotPasswordForm.jsx). */
export default function ForgotPasswordPage() {
  return (
    <AuthCard
      title="Forgot your password?"
      subtitle="Enter your account’s email. We’ll send you a 6-digit code to choose a new password."
      footer={
        <Link href="/login" className="font-medium text-black hover:underline">
          Back to log in
        </Link>
      }
    >
      <ForgotPasswordForm />
    </AuthCard>
  );
}
