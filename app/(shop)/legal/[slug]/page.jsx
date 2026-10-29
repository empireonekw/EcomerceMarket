import { notFound } from 'next/navigation';
import LegalPage from '@/components/LegalPage';
import { POLICIES, POLICY_UPDATED } from '@/lib/policies';

// Only the policies in lib/policies.js exist; every page is generated at build time.
export const dynamicParams = false;
export const generateStaticParams = () => Object.keys(POLICIES).map((slug) => ({ slug }));

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const policy = POLICIES[slug];
  return policy ? { title: policy.title, description: policy.description, alternates: { canonical: `/legal/${slug}` } } : {};
}

/** /legal/refund-policy, /legal/cookie-policy, … (content in lib/policies.js). */
export default async function PolicyPage({ params }) {
  const policy = POLICIES[(await params).slug];
  if (!policy) notFound();
  return <LegalPage title={policy.title} updated={POLICY_UPDATED} intro={policy.intro} sections={policy.sections} />;
}
