import LegalPage from '@/components/LegalPage';

export const metadata = { title: 'Privacy Policy' };

// Factual summary of the data the site actually stores. Replace with reviewed legal text before launch.
const SECTIONS = [
  { heading: 'What we store', body: 'Your name, email address, a securely hashed password, your orders and download history. Sellers also provide a store name and payout details.' },
  { heading: 'Cookies', body: 'We use a secure session cookie to keep you signed in and your browser’s local storage to remember your cart. We don’t use advertising cookies.' },
];

export default function PrivacyPage() {
  return <LegalPage title="Privacy Policy" updated="October 2026" sections={SECTIONS} />;
}
