import LegalPage from '@/components/LegalPage';
import { siteConfig } from '@/lib/site';

export const metadata = {
  title: 'Privacy Policy',
  description: `What personal data ${siteConfig.name} stores, why, who can see it and how to get it changed or deleted.`,
  alternates: { canonical: '/privacy' },
};

const { name, operator, supportEmail } = siteConfig;
const provider = siteConfig.paymentProvider || 'our payment provider';

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
        'Account details: your name, email address, mobile number and a securely hashed password (we never store your password itself). If you sign in with Google, we receive your name, email address and Google account ID from Google.',
        'Orders: what you bought, the amount paid, the email address and mobile number used at checkout, the payment reference from our payment provider, and when each item was downloaded.',
        'Sellers: your shop name and description, your shop address and phone number, your products, your sales and earnings, and the bank or mobile wallet details you give us for payouts. Payout details are encrypted when stored.',
        'Seller identity checks: before a seller’s first payout we collect photos of both sides of their government ID and a live selfie, to prevent fraud and confirm who we are paying. These files are private: only the seller and the team members who review them can open them.',
        'Reviews: the rating and text you write, shown publicly with your name.',
        'Messages: what you send us through the Contact Us page, with your name and email address.',
        'Security data: your IP address, used briefly to stop abuse such as repeated failed logins. It is not used for tracking or advertising.',
      ],
    ],
  },
  {
    id: 'payments',
    heading: 'Payments',
    body: [
      `Payments are processed by ${provider}. When you pay, you enter your card, wallet or bank details on their secure page, and they receive the order amount, your email address and your mobile number to process the payment and prevent fraud. We never see or store your full card number or wallet PIN. ${provider} handles that information under its own privacy policy.`,
      'Some orders are paid through Lemon Squeezy, which acts as the Merchant of Record for them. For those orders you enter your details on Lemon Squeezy’s checkout, and it collects your name, email address, billing country and payment details to process the payment and charge the right tax. We receive the order reference, your name, email address, country, the amount and the payment status, never your full card number. Lemon Squeezy handles your data under its own Privacy Policy (lemonsqueezy.com/privacy). Our Lemon Squeezy Payments & Privacy page has the details.',
      'Because we collect payments for sellers, we also keep the records needed to pay them their earnings, handle refunds and chargebacks, and meet accounting and anti-fraud obligations.',
    ],
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
      [
        'Service providers we need to run the Marketplace: website hosting, our database and file storage providers, and our email provider, only for that purpose.',
        `Our payment provider (${provider}), to process payments and refunds and prevent fraud.`,
        'Lemon Squeezy, our Merchant of Record for orders paid through it, to process those payments, charge sales tax or VAT, handle refunds and prevent fraud.',
        'Banks and wallet providers, to send sellers their payouts (only the payout details and amount).',
        'Authorities, when the law requires it, for example to investigate fraud.',
      ],
      'We don’t sell your data or share it with advertisers.',
    ],
  },
  {
    id: 'retention',
    heading: 'How long we keep it',
    body: [
      'We keep your account data while your account is open. If your account is deleted, we remove your profile, but we keep order and payment records for as long as accounting and tax law requires. Those records are no longer linked to an account. Seller identity documents are kept while the shop is open and for as long as anti-fraud and financial record-keeping rules require after it closes. We delete messages sent through the Contact Us page once they are no longer needed to help you.',
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
      updated="11 November 2026"
      intro={`This policy explains what personal data ${name} keeps, why we keep it, who can see it and how you can have it changed or deleted.`}
      sections={SECTIONS}
    />
  );
}
