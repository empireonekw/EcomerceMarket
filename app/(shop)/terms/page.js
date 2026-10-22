import LegalPage from '@/components/LegalPage';
import { commissionPercent, COMMISSION_RATE } from '@/lib/commission';
import { siteConfig } from '@/lib/site';
import { DOWNLOADS_PER_HOUR } from '@/lib/downloads';

export const metadata = {
  title: 'Terms of Service',
  description: `The terms for buying and selling on ${siteConfig.name}: lifetime re-downloads, refunds, licences and seller rights.`,
};

const { name, operator, supportEmail } = siteConfig;
const sellerShare = commissionPercent(1 - COMMISSION_RATE);
const fee = commissionPercent();

// Plain-language terms that match how the site actually works. Have them reviewed by a lawyer for your
// jurisdiction before launch, and update `updated` below whenever they change.
const SECTIONS = [
  {
    id: 'about',
    heading: 'About these terms',
    body: [
      `${name} (“the Marketplace”, “we”, “us”) is an online marketplace for digital products, owned and operated by ${operator}. These terms apply to everyone who browses, buys from or sells on the Marketplace.`,
      'By creating an account, placing an order or listing a product, you agree to these terms and to our Privacy Policy. If you don’t agree, please don’t use the Marketplace.',
    ],
  },
  {
    id: 'accounts',
    heading: 'Accounts',
    body: [
      [
        'You sign in with your email address and a password. Keep your password private — you’re responsible for activity on your account.',
        'Shopping accounts and seller accounts are separate, so your purchases and your shop never mix.',
        'Give us accurate details and keep your email address up to date: it’s how we send receipts and reach you about your orders.',
        'You must be old enough to form a binding contract where you live, or have a parent or guardian’s permission.',
      ],
    ],
  },
  {
    id: 'purchases',
    heading: 'Purchases and delivery',
    body: [
      'Prices are shown in US dollars and include any tax or service fee shown at checkout. Your order is confirmed once payment succeeds.',
      'Products are delivered instantly after checkout: downloadable files through a private download link, and Figma, Notion and similar templates through a private access link. Links appear on your receipt and in My Purchases.',
    ],
  },
  {
    id: 'downloads',
    heading: 'Lifetime re-downloads',
    body: [
      'Every product you buy is yours to keep. It stays in your account for as long as the Marketplace operates, and you can re-download it as often as you need, at no extra cost.',
      [
        'Re-download any time from My Purchases in your account, or from your order receipt.',
        'You always get the latest version of the file the seller provides.',
        'If a seller stops selling a product, or closes their shop, you keep access to everything you already bought.',
        'Checked out as a guest? Your receipt link works the same way, and you can add the order to an account at any time to keep everything in one place.',
      ],
      `For security, download links are private to your order and refresh each time you open the page, and each item can be downloaded up to ${DOWNLOADS_PER_HOUR} times per hour. This stops shared links from being abused — it never limits how many times you can download over the lifetime of your purchase.`,
    ],
  },
  {
    id: 'licence',
    heading: 'Using what you buy',
    body: [
      'When you buy a product you get a non-exclusive licence to use it as described on its product page. Unless the product page says otherwise:',
      [
        'You may use it in your own personal and client projects.',
        'You may not resell, share, sublicense or redistribute the original files — on their own or in a bundle, template marketplace or file-sharing site.',
        'Ownership of the product stays with the seller who made it.',
      ],
    ],
  },
  {
    id: 'refunds',
    heading: 'Refund policy',
    body: [
      'Because digital products are delivered instantly and can’t be returned, sales are generally final. We will give you a full refund when:',
      [
        'the file is faulty, corrupted or can’t be downloaded, and we or the seller can’t fix it;',
        'the product is materially different from its description; or',
        'you were charged twice or bought the same product twice by mistake.',
      ],
      `To ask for a refund, contact us within 14 days of your purchase at ${supportEmail} or through the Contact Us page, with your order number and a short description of the problem. We reply within 1–2 business days.`,
      'Approved refunds go back to your original payment method, usually within 5–10 business days depending on your bank. Once an order is refunded, its download and access links stop working, and the seller’s earnings for that sale are reversed.',
    ],
  },
  {
    id: 'sellers',
    heading: 'Seller rights and responsibilities',
    body: [
      'Sellers are independent creators. When you sell on the Marketplace, you have these rights:',
      [
        'You keep ownership. You keep all copyright and other rights in your products. Listing a product only gives us a non-exclusive, worldwide, royalty-free licence to host, show, promote and deliver it to buyers. That licence ends when you remove the product, except for buyers who already bought it, who keep their lifetime access.',
        'You control your listings. You set your own prices, and you can edit, hide or delete your products at any time from your seller dashboard. New products and edits are reviewed before they go live.',
        `You keep ${sellerShare} of every sale. A ${fee} platform commission covers hosting, payments, delivery and support. Your earnings and full sales history are always visible in your dashboard.`,
        'You get paid. Earnings are paid out to the bank account or mobile wallet you add in your dashboard.',
        'Fair treatment. If we decline or remove a listing, you can contact us to find out why and ask for it to be reviewed again.',
      ],
      'In return, you confirm that you own or have the right to sell everything you upload. You agree to describe your products accurately and to help buyers with reasonable questions about them.',
    ],
  },
  {
    id: 'acceptable-use',
    heading: 'Acceptable use',
    body: [
      [
        'Don’t upload content you don’t have the rights to, or anything illegal, harmful, deceptive or containing malware.',
        'Don’t share purchased files or download links publicly.',
        'Don’t try to interfere with the Marketplace, get around its security, or access other people’s accounts.',
      ],
      'We may remove content or suspend accounts that break these rules. If your account is affected, contact us and we will explain why.',
    ],
  },
  {
    id: 'liability',
    heading: 'Our responsibility to you',
    body: [
      'We work hard to keep the Marketplace available and products safe to download, but we can’t promise uninterrupted service. Products are provided by their sellers, and as far as the law allows, our liability for any claim about an order is limited to the amount you paid for it. Nothing in these terms limits rights you have under consumer law that can’t be excluded.',
    ],
  },
  {
    id: 'changes',
    heading: 'Changes to these terms',
    body: [
      'We may update these terms as the Marketplace grows. When we do, we will change the “Last updated” date above and show a notice on the site for important changes before they take effect. Purchases are always governed by the terms in place when you made them.',
    ],
  },
  {
    id: 'contact',
    heading: 'Contact',
    body: [`Questions about these terms, an order or a refund? Email ${supportEmail} or use the Contact Us page. We reply within 1–2 business days.`],
  },
];

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      updated="October 2026"
      intro={`These terms explain how buying and selling works on ${name}: what you get when you buy, how refunds work, and the rights sellers keep.`}
      sections={SECTIONS}
    />
  );
}
