import AuthCard from '@/components/auth/AuthCard';
import RobotCheckForm from '@/components/auth/RobotCheckForm';
import { safeNext } from '@/lib/robot-check';

export const metadata = { title: 'Verify you’re not a robot', robots: { index: false } };

/** Shown to visitors who went over the site's request limits (proxy.js → lib/robot-check.js). */
export default async function VerifyPage({ searchParams }) {
  const { next } = await searchParams;
  return (
    <AuthCard title="Quick check" subtitle="We noticed a lot of requests from your connection. Please confirm you’re not a robot to continue.">
      <RobotCheckForm next={safeNext(next)} />
    </AuthCard>
  );
}
