import LegalPage from '@/components/LegalPage';

export const metadata = { title: 'Terms of Service' };

// Factual summary of how the marketplace works. Replace with reviewed legal text before launch.
const SECTIONS = [
  { heading: 'Accounts', body: 'You sign in with your email and password, and you’re responsible for keeping them secure.' },
  { heading: 'Purchases and delivery', body: 'Digital products are delivered instantly after checkout through private, expiring download links. Each purchased item can be downloaded a limited number of times.' },
  { heading: 'Selling', body: 'Sellers keep 90% of each sale; a 10% platform fee applies. New products are reviewed before they go live. Earnings are paid out manually to the bank account or mobile wallet on file.' },
  { heading: 'Acceptable use', body: 'Don’t upload content you don’t own the rights to, share purchased files publicly, or attempt to interfere with the platform.' },
];

export default function TermsPage() {
  return <LegalPage title="Terms of Service" updated="October 2026" sections={SECTIONS} />;
}
