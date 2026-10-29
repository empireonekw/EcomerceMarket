import LegalPage from '@/components/LegalPage';
import { HOW_IT_WORKS, POLICY_UPDATED } from '@/lib/policies';

export const metadata = {
  title: HOW_IT_WORKS.title,
  description: HOW_IT_WORKS.description,
  alternates: { canonical: '/how-it-works' },
};

/** /how-it-works — buying, selling and the listing review methodology (content in lib/policies.js). */
export default function HowItWorksPage() {
  return <LegalPage eyebrow="Guide" title={HOW_IT_WORKS.title} updated={POLICY_UPDATED} intro={HOW_IT_WORKS.intro} sections={HOW_IT_WORKS.sections} />;
}
