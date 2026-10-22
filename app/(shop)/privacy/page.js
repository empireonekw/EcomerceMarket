import LegalPage from '@/components/LegalPage';
import { siteConfig } from '@/lib/site';

export const metadata = {
  title: 'Privacy Policy',
  description: `What personal data ${siteConfig.name} stores, why, who can see it and how to get it changed or deleted.`,
};

const { name, operator, supportEmail } = siteConfig;

// Describes the data the site actually stores. Have it reviewed for your jurisdiction before launch,
// and update `updated` below whenever it changes.
const SECTIONS = [
  {
    id: 'who-we-are',
    heading: 'Who we are',
    body: [
      `${name} is owned and operated by ${operator}, which is responsible for the personal data described here. You can reach us about privacy at any time at ${supportEmail}.`,
    ],
  },
  {
    id: 'what-we-collect',
    heading: 'What we collect',
    body: [
      [
        'Account details: your name, email address and a securely hashed password (we never store your password itself).',
        'Orders: what you bought, the amount paid, the email address used at checkout, and when each item was downloaded.',
        'Sellers: your shop name and description, your products, your sales and earnings, and the bank or mobile wallet details you give us for payouts.',
        'Reviews: the rating and text you write, shown publicly with your name.',
        'Messages: what you send us through the Contact Us page, with your name and email address.',
        'Security data: your IP address, used briefly to stop abuse such as repeated failed logins. It is not used for tracking or advertising.',
      ],
    ],
  },
  {
    id: 'payments',
    heading: 'Payments',
    body: ['Card payments are processed by our payment provider over an encrypted connection. We never see or store your full card number.'],
  },
  {
    id: 'how-we-use',
    heading: 'How we use your data',
    body: [
      [
        'To run your account and deliver what you buy, including lifetime re-downloads.',
        'To pay sellers what they have earned and keep accurate sales records.',
        'To answer your messages, handle refunds and provide support.',
        'To keep the Marketplace secure and prevent fraud.',
      ],
      'We don’t sell your personal data, and we don’t use it for advertising.',
    ],
  },
  {
    id: 'sellers',
    heading: 'What sellers can see',
    body: [
      'When you buy a product, its seller sees the sale, the amount and a partly hidden version of your email address (for example j•••@example.com). Sellers never see your full email address, your password or your payment details.',
    ],
  },
  {
    id: 'cookies',
    heading: 'Cookies and local storage',
    body: [
      [
        'A secure session cookie keeps you signed in. It can’t be read by scripts on the page.',
        'A small companion cookie tells the site you’re signed in, so the right menu shows immediately.',
        'Your browser’s local storage remembers what’s in your cart.',
      ],
      'We don’t use advertising or third-party tracking cookies, so there is nothing to opt out of.',
    ],
  },
  {
    id: 'sharing',
    heading: 'Who we share it with',
    body: [
      'We share data only with the service providers we need to run the Marketplace — website hosting, our database provider and our payment provider — and only for that purpose. We may also disclose data when the law requires it.',
    ],
  },
  {
    id: 'retention',
    heading: 'How long we keep it',
    body: [
      'We keep your account data while your account is open. If your account is deleted, we remove your profile, but we keep order and payment records for as long as accounting and tax law requires. Those records are no longer linked to an account. We delete messages sent through the Contact Us page once they are no longer needed to help you.',
    ],
  },
  {
    id: 'your-rights',
    heading: 'Your rights',
    body: [
      'You can update your name and password at any time in your account. You can also ask us for a copy of your data, to correct it, or to delete your account. Email us at the address below and we will respond within 30 days.',
    ],
  },
  {
    id: 'security',
    heading: 'Security',
    body: [
      'Passwords are hashed with bcrypt, sessions use secure HTTP-only cookies, and files are only ever delivered through private, signed links tied to your order. No system is perfectly secure, but we take reasonable steps to protect your data.',
    ],
  },
  {
    id: 'contact',
    heading: 'Contact',
    body: [`Questions about your data or this policy? Email ${supportEmail} or use the Contact Us page.`],
  },
];

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      updated="October 2026"
      intro={`This policy explains what personal data ${name} keeps, why we keep it, who can see it and how you can have it changed or deleted.`}
      sections={SECTIONS}
    />
  );
}
