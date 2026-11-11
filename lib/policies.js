// Content for the policy pages under /legal/<slug> and /how-it-works (rendered by components/LegalPage.jsx).
// Plain language that matches how the site actually works. Have them reviewed for your jurisdiction before launch,
// and update `updated` whenever a page changes.
import { NO_PLATFORM_FEE, commissionPercent, COMMISSION_RATE, MIN_PAYOUT, PAYOUT_FEE, PAYOUT_FEE_LABEL, payoutFee } from '@/lib/commission';
import { DOWNLOADS_PER_HOUR } from '@/lib/downloads';
import { PRICING, CHARGE_CURRENCY, chargeAmount, formatTaxRate } from '@/lib/pricing';
import { siteConfig } from '@/lib/site';
import { formatPrice } from '@/lib/utils';
import { WALLET_OPTIONS } from '@/lib/validation';

const { name, operator, supportEmail, paymentProvider, billingDescriptor, address } = siteConfig;
const provider = paymentProvider || 'our payment provider';
const UPDATED = '11 November 2026';
const minPayout = formatPrice(MIN_PAYOUT, 'USD');
const walletLabels = WALLET_OPTIONS.map((w) => w.label);
const wallets = `${walletLabels.slice(0, -1).join(', ')} or ${walletLabels.at(-1)}`;
// The operator at the start of a sentence ("the Sellpify team" → "The Sellpify team").
const Operator = operator.charAt(0).toUpperCase() + operator.slice(1);
// Rupees per dollar used at checkout (lib/pricing.js), e.g. 280.
const usdRate = chargeAmount(100, 'USD').rate;

export const POLICIES = {
  'refund-policy': {
    title: 'Refund Policy',
    summary: 'When you can get your money back, and how.',
    description: `When ${name} refunds an order, how to ask, and how long it takes.`,
    intro: 'Digital products are delivered instantly and can’t be returned, so sales are generally final, but if something is wrong with your order, we will make it right.',
    sections: [
      {
        id: 'eligible',
        heading: 'When you get a full refund',
        body: [
          [
            'The file is faulty, corrupted or can’t be downloaded, and we or the seller can’t fix it.',
            'The product is materially different from its description or preview images.',
            'You were charged twice, or bought the same product twice by mistake.',
            'A service you ordered was not delivered and the seller can’t complete it.',
          ],
        ],
      },
      {
        id: 'not-eligible',
        heading: 'When we can’t refund',
        body: [
          [
            'You changed your mind after downloading the files.',
            'You didn’t read the product description, file formats or software requirements before buying.',
            'You bought the wrong licence or product and have already downloaded it.',
          ],
          'If you’re unsure whether a product will work for you, message the seller before you buy. Every shop has a direct line.',
        ],
      },
      {
        id: 'how-to-ask',
        heading: 'How to ask for a refund',
        body: [
          `Contact us within 14 days of your purchase at ${supportEmail} or through the Contact Us page. Include your order number and a short description of the problem. Screenshots help. We reply within 1–2 business days.`,
          'We may first ask the seller to fix the problem or send a corrected file. If they can’t, we refund you.',
        ],
      },
      {
        id: 'timing',
        heading: 'How refunds are paid',
        body: [
          'Approved refunds go back to your original payment method, usually within 5–10 business days depending on your bank.',
          'Once an order is refunded, its download links stop working and the seller’s earnings for that sale are reversed.',
        ],
      },
      {
        id: 'lemon-squeezy',
        heading: 'Orders paid through Lemon Squeezy',
        body: [
          'If you paid through Lemon Squeezy, our Merchant of Record for those orders, ask us for a refund in the same way. Approved refunds are issued through Lemon Squeezy, and its Buyer Terms also apply. See Lemon Squeezy Payments & Privacy for details.',
        ],
      },
      {
        id: 'chargebacks',
        heading: 'Chargebacks',
        body: [
          'Please contact us before opening a dispute with your bank. It is almost always faster. Accounts with repeated chargebacks for orders that were delivered as described may be suspended.',
        ],
      },
    ],
  },

  // ---- Pages payment providers ask for during merchant review (alongside Terms, Privacy and Refund). ----

  'payment-policy': {
    title: 'Payment Policy',
    summary: 'How you pay, what you’re charged and how card data is protected.',
    description: `Accepted payment methods, currency, taxes and fees, and how ${name} keeps your payment details safe.`,
    intro: `Everything you need to know about paying on ${name}: what you’re charged, when, and how your payment details are protected.`,
    sections: [
      {
        id: 'who',
        heading: 'Who you’re paying',
        body: [
          `${name} is a marketplace: most products are made and sold by independent sellers. When you buy, ${operator} collects your payment on the seller’s behalf, as their payment collection agent, and passes the seller’s share on to them under our Payout Policy. Paying us settles what you owe the seller for that order.`,
          'Your order, receipt, refunds and any questions about a charge are handled by us, so you always have one place to go.',
        ],
      },
      {
        id: 'methods',
        heading: 'How you can pay',
        body: [
          `Payments are taken at checkout through ${provider}, which accepts major debit and credit cards and any other methods shown on the payment screen.`,
          'Free products need no payment details at all.',
        ],
      },
      {
        id: 'prices',
        heading: 'Prices, currency and fees',
        body: [
          [
            CHARGE_CURRENCY === 'USD'
              ? 'All prices are shown and charged in US dollars (USD). If your card is in another currency, your bank converts it and may add its own fee.'
              : `Prices are listed in US dollars (USD). At checkout the total is converted and charged in ${CHARGE_CURRENCY === 'PKR' ? 'Pakistani rupees (PKR)' : CHARGE_CURRENCY} at $1 = ${CHARGE_CURRENCY === 'PKR' ? 'Rs' : CHARGE_CURRENCY} ${usdRate}, rounded up to the nearest whole ${CHARGE_CURRENCY === 'PKR' ? 'rupee' : 'unit'}. The exact amount is shown before you pay. If your card is in another currency, your bank converts it and may add its own fee.`,
            PRICING.taxRate > 0 ? `Tax of ${formatTaxRate()} is added at checkout where it applies, and shown before you pay.` : 'Prices include any applicable tax; nothing is added at checkout.',
            PRICING.serviceFeeCents > 0
              ? `A service fee of ${formatPrice(PRICING.serviceFeeCents, 'USD')} per order is shown in your order summary before you pay.`
              : 'There are no hidden fees: the total in your order summary is exactly what you pay.',
            'Sellers set their own prices. A price can change at any time, but never after you’ve paid.',
          ],
        ],
      },
      {
        id: 'when',
        heading: 'When you’re charged',
        body: [
          'You’re charged once, when you complete checkout. There are no subscriptions or recurring charges.',
          'Your order is confirmed the moment payment succeeds, and your products are delivered straight away (see the Delivery Policy).',
          billingDescriptor
            ? `The charge appears on your statement as “${billingDescriptor}”.`
            : `The charge appears on your statement under the ${name} name.`,
        ],
      },
      {
        id: 'security',
        heading: 'How your payment details are protected',
        body: [
          [
            `Card details are entered on, and processed by, ${provider}, a PCI DSS compliant payment processor. Full card numbers never reach or are stored on our servers.`,
            'Every page is served over an encrypted HTTPS (TLS) connection.',
            'We keep only what’s needed for your records: the order, its amount and the payment reference.',
          ],
        ],
      },
      {
        id: 'failed',
        heading: 'Failed or duplicate payments',
        body: [
          'If a payment fails, no order is placed and you can try again. If you were charged twice, or charged for an order that wasn’t completed, contact us and we will refund the extra charge in full.',
        ],
      },
      {
        id: 'contact',
        heading: 'Questions about a charge',
        body: [
          `Email ${supportEmail} with your order number and we will reply within 1–2 business days. Please contact us before opening a dispute with your bank. It’s almost always faster.${address ? ` Our business address: ${address}.` : ''}`,
        ],
      },
    ],
  },

  // Lemon Squeezy (lemonsqueezy.com) as an additional checkout, beside PayFast. When a buyer pays through it,
  // Lemon Squeezy is the Merchant of Record: it resells the product, charges sales tax / VAT and handles the payment.
  'lemon-squeezy': {
    title: 'Lemon Squeezy Payments & Privacy',
    summary: 'Orders paid through Lemon Squeezy, our Merchant of Record.',
    description: `How orders paid through Lemon Squeezy work on ${name}: Merchant of Record, taxes, refunds and what personal data is shared.`,
    intro: `Some payments on ${name} are processed by Lemon Squeezy, an online reseller and Merchant of Record. This page explains what that means for your order, your taxes, refunds and your personal data. It adds to our Privacy Policy, Payment Policy and Refund Policy.`,
    sections: [
      {
        id: 'who',
        heading: 'Who Lemon Squeezy is',
        body: [
          'Lemon Squeezy is a payment platform that acts as the Merchant of Record and authorised reseller for the orders it processes. When you pay through Lemon Squeezy, it sells the product to you on our behalf, takes the payment, and charges and pays any sales tax or VAT due.',
          'Because of this, your receipt, and the charge on your card or bank statement, may show Lemon Squeezy rather than our name.',
        ],
      },
      {
        id: 'when',
        heading: 'When this page applies',
        body: [
          'It applies to orders where the checkout shows Lemon Squeezy as the payment provider. You will always see which provider you’re paying before you enter any payment details.',
          `Orders paid through ${provider} follow our Payment Policy instead. Free products need no payment at all.`,
        ],
      },
      {
        id: 'prices-taxes',
        heading: 'Prices and taxes',
        body: [
          [
            'Prices are listed in US dollars. Lemon Squeezy may show the amount in your local currency and converts it at its own rate.',
            'Lemon Squeezy adds sales tax or VAT based on where you are, as the law requires, and shows it before you pay.',
            'If you’re a business registered for tax, you can enter your tax ID at checkout. Where local law allows, Lemon Squeezy may refund tax that was charged by mistake if you ask within 60 days of purchase.',
          ],
        ],
      },
      {
        id: 'delivery',
        heading: 'Delivery',
        body: [
          'As soon as Lemon Squeezy confirms your payment, we deliver your products the same way as every other order: private download or access links on your receipt and in My Purchases, with lifetime re-downloads (see the Delivery Policy).',
        ],
      },
      {
        id: 'data-shared',
        heading: 'What personal data Lemon Squeezy receives',
        body: [
          'When you pay through Lemon Squeezy, you enter your details on its secure checkout. Lemon Squeezy collects:',
          [
            'your name and email address, so it can send your receipt;',
            'your billing country and, where needed, your postal code or address, to work out the right tax;',
            'your card or other payment details, which are handled by Lemon Squeezy and its PCI DSS compliant payment processors;',
            'technical data such as your IP address and device information, to prevent fraud;',
            'your tax ID, if you choose to enter one.',
          ],
          'We give Lemon Squeezy only what’s needed to set up the payment: the products and prices in your order, an order reference, and the email address you entered at our checkout.',
        ],
      },
      {
        id: 'data-received',
        heading: 'What we receive back',
        body: [
          'Lemon Squeezy sends us the order reference, your name, email address and country, the amount paid, the tax charged and whether the payment succeeded, was refunded or was disputed. We use this to deliver your products, keep accurate records, pay the sellers whose products you bought, and handle refunds and support.',
          'We never receive or store your full card number, security code or wallet login.',
        ],
      },
      {
        id: 'their-policy',
        heading: 'How Lemon Squeezy handles your data',
        body: [
          'Lemon Squeezy uses the data it collects under its own Privacy Policy (lemonsqueezy.com/privacy) and Buyer Terms (lemonsqueezy.com/buyer-terms), as a data controller and/or processor. Lemon Squeezy is based in the United States, so your data may be processed there, with the safeguards described in its privacy policy and Data Processing Agreement (lemonsqueezy.com/dpa).',
          'Its checkout may use its own cookies to process the payment and prevent fraud. These are set by Lemon Squeezy, not by us, and are covered by its policy.',
        ],
      },
      {
        id: 'refunds',
        heading: 'Refunds',
        body: [
          [
            `Ask us for a refund at ${supportEmail} under our Refund Policy, within 14 days of purchase. We review it, and approved refunds are issued through Lemon Squeezy to your original payment method.`,
            'Lemon Squeezy’s Buyer Terms also apply to these orders. To prevent chargebacks, Lemon Squeezy may issue a refund itself in some cases.',
            'Once an order is refunded, its download links stop working.',
          ],
        ],
      },
      {
        id: 'billing-questions',
        heading: 'Billing questions and your rights',
        body: [
          `If you don’t recognise a Lemon Squeezy charge, or have a question about one, email ${supportEmail} with your order number or the email you used. Please contact us before opening a dispute with your bank. It’s almost always faster.`,
          'To access, correct or delete the data we hold, see “Your rights” in our Privacy Policy. For the data Lemon Squeezy holds, you can also contact Lemon Squeezy directly through its website.',
        ],
      },
    ],
  },

  'delivery-policy': {
    title: 'Delivery Policy',
    summary: 'How and when you receive what you buy.',
    description: `How ${name} delivers digital products, instantly after payment, and what to do if something doesn’t arrive.`,
    intro: `Most products on ${name} are digital, so there is nothing to ship: you get them the moment your payment succeeds.`,
    sections: [
      {
        id: 'digital',
        heading: 'Digital products: instant delivery',
        body: [
          [
            'Downloadable files (PDF, ZIP and other files) are delivered through a private download link.',
            'Templates and tools such as Canva, Notion, Figma or Google Sheets are delivered through a private access link.',
            'Links appear right after checkout on your order receipt and, when you’re signed in, in My Purchases.',
          ],
          'There are no shipping costs and nothing is sent by post for digital products.',
        ],
      },
      {
        id: 'access',
        heading: 'Lifetime access',
        body: [
          `Re-download your products any time from My Purchases or your receipt link. To keep links from being shared, each item can be downloaded up to ${DOWNLOADS_PER_HOUR} times per hour.`,
          'Checked out as a guest? Your receipt link works the same way, and you can add the order to an account later.',
        ],
      },
      {
        id: 'other',
        heading: 'Services and physical items',
        body: [
          'If a listing offers a service or a physical item, the seller states how and when it’s delivered on the listing, and you can message them before you buy. If it isn’t delivered as described, the Refund Policy applies.',
        ],
      },
      {
        id: 'problems',
        heading: 'If something doesn’t arrive or won’t open',
        body: [
          `Email ${supportEmail} with your order number. We usually fix delivery problems within 1–2 business days, by sending a working link, asking the seller for a corrected file, or refunding you under the Refund Policy.`,
        ],
      },
    ],
  },

  'cancellation-policy': {
    title: 'Cancellation Policy',
    summary: 'Cancelling an order before or after payment.',
    description: `When and how an order on ${name} can be cancelled.`,
    intro: 'Because digital products are delivered the moment payment succeeds, there is usually no window to cancel, but here is exactly what applies.',
    sections: [
      {
        id: 'before',
        heading: 'Before you pay',
        body: ['You can cancel at any time before completing payment: simply leave checkout or remove items from your cart. Nothing is charged.'],
      },
      {
        id: 'after',
        heading: 'After you pay',
        body: [
          'Digital products are delivered instantly, so a completed order can’t be cancelled. If the product is faulty, not as described, or you were charged twice, you’re covered by the Refund Policy.',
          'For a service a seller hasn’t started yet, contact us and we will cancel it and refund you in full.',
        ],
      },
      {
        id: 'by-us',
        heading: 'Cancellations by us',
        body: [
          'We may cancel and fully refund an order if a payment looks fraudulent, a listing breaks our policies, or a product can’t be delivered. We will email you if this happens.',
        ],
      },
      {
        id: 'how',
        heading: 'How to ask',
        body: [`Email ${supportEmail} or use the Contact Us page with your order number. We reply within 1–2 business days.`],
      },
    ],
  },

  'cookie-policy': {
    title: 'Cookie Policy',
    summary: 'The few cookies we use and why.',
    description: `The cookies and browser storage ${name} uses. No advertising or tracking cookies.`,
    intro: 'We keep this short because there isn’t much to say: we only use what the site needs to work.',
    sections: [
      {
        id: 'what-we-use',
        heading: 'What we use',
        body: [
          [
            'Session cookie (essential): keeps you signed in. It is HTTP-only, so scripts on the page can’t read it, and it expires when your session ends.',
            'Sign-in hint cookie (essential): tells the site you’re signed in so the right menu appears straight away. It contains no personal data.',
            'Local storage (essential): your browser remembers what’s in your cart, so it’s still there when you come back.',
          ],
        ],
      },
      {
        id: 'what-we-dont',
        heading: 'What we don’t use',
        body: ['No advertising cookies, no cross-site tracking and no selling of browsing data. Because of that, there is no cookie banner and nothing to opt out of.'],
      },
      {
        id: 'control',
        heading: 'Controlling cookies',
        body: [
          'You can clear or block cookies in your browser settings at any time. If you block the essential cookies, you won’t be able to sign in or check out, but you can still browse.',
        ],
      },
      {
        id: 'changes',
        heading: 'Changes',
        body: ['If we ever add a cookie that isn’t essential, we will update this page first and ask for your consent where the law requires it.'],
      },
    ],
  },

  'acceptable-use': {
    title: 'Acceptable Use Policy',
    summary: 'What can and can’t be sold or done here.',
    description: `The rules for buying, selling and messaging on ${name}.`,
    intro: `${name} works because buyers can trust what they find and sellers can trust that their work is respected. These rules apply to everyone.`,
    sections: [
      {
        id: 'prohibited-items',
        heading: 'Items you can’t list',
        body: [
          [
            'Anything you don’t own or don’t have the rights to sell, including resold PLR, “free for personal use” assets and copies of other creators’ work.',
            'Illegal products or services, weapons, drugs, counterfeit goods and stolen data.',
            'Malware, cracked software, licence-key generators or anything designed to cause harm.',
            'Adult content, hate speech, harassment or content that exploits minors.',
            'Misleading “get rich quick” schemes, fake reviews or followers, and academic cheating services.',
          ],
        ],
      },
      {
        id: 'listings',
        heading: 'Honest listings',
        body: [
          [
            'Titles, descriptions, photos and file formats must match what the buyer receives.',
            'Use preview images of the actual product. Mock-ups are fine if they show the real design.',
            'Pick the category that fits best, don’t list in an unrelated category to get more views.',
          ],
        ],
      },
      {
        id: 'conduct',
        heading: 'Conduct',
        body: [
          [
            'Be respectful in messages. No spam, threats or pressure tactics.',
            'Keep payments on the platform. Asking buyers to pay outside it is not allowed.',
            'Don’t share purchased files or download links publicly.',
            'Don’t try to get around our security, scrape the site, or access other people’s accounts.',
          ],
        ],
      },
      {
        id: 'enforcement',
        heading: 'What happens if rules are broken',
        body: [
          'Depending on how serious it is, we may decline or remove a listing, hold payouts linked to the problem, or suspend the account. We tell you what happened and why, and you can ask us to review the decision.',
          `To report a listing, shop or message, email ${supportEmail} with a link and a short description.`,
        ],
      },
    ],
  },

  'seller-agreement': {
    title: 'Seller Agreement',
    summary: 'Your rights and responsibilities as a seller.',
    description: `What sellers on ${name} agree to: ownership, listings, review, earnings and payouts.`,
    intro: `This agreement applies when you open a shop on ${name}. It sits alongside the Terms of Service and the Acceptable Use Policy.`,
    sections: [
      {
        id: 'ownership',
        heading: 'You keep ownership',
        body: [
          'You keep all copyright and other rights in your products. Listing a product only gives us a non-exclusive, worldwide, royalty-free licence to host, show, promote and deliver it to buyers. That licence ends when you remove the product, except for buyers who already bought it, who keep lifetime access.',
        ],
      },
      {
        id: 'listings',
        heading: 'Your listings',
        body: [
          [
            'You set your own prices and can edit, hide or delete listings at any time from your dashboard.',
            'Every new listing and every edit is reviewed before it goes live (see How It Works for our review process).',
            'You confirm you own or have the right to sell everything you upload, and that descriptions are accurate.',
          ],
        ],
      },
      {
        id: 'earnings',
        heading: 'Earnings and fees',
        body: [
          NO_PLATFORM_FEE
            ? `We don’t charge a platform fee or commission on sales: the full sale price goes into your balance. The only deduction is a merchant fee of ${PAYOUT_FEE_LABEL}, taken once from each withdrawal to cover payment processing and transfer costs (see the Payout Policy). If our fees ever change, we will tell you in advance and the change will only apply to future withdrawals.`
            : `You keep ${commissionPercent(1 - COMMISSION_RATE)} of every sale. A ${commissionPercent()} platform commission covers hosting, payments, delivery and support.`,
          'Your earnings and full sales history are always visible in your dashboard.',
        ],
      },
      {
        id: 'collection',
        heading: 'We collect payments for you',
        body: [
          `You appoint ${operator} as your limited agent to collect payments from buyers for your products, through ${provider}. When a buyer pays us, that counts as the buyer paying you, and the buyer owes you nothing more for that order. We then owe you your earnings, as set out in the Payout Policy.`,
          'You are the seller of every product you list. The sale is between you and the buyer, and you are responsible for the product, its description and any taxes due on your earnings.',
        ],
      },
      {
        id: 'payouts',
        heading: 'Payouts',
        body: [
          `Earnings are paid to the bank account or mobile wallet you add on the Payouts page, once your balance reaches ${formatPrice(MIN_PAYOUT, 'USD')} and your identity is verified. A ${PAYOUT_FEE_LABEL} merchant fee is deducted from each withdrawal. Keep those details accurate. We aren’t responsible for payments sent to details you entered incorrectly. Earnings from refunded orders are reversed. The Payout Policy has the full rules.`,
        ],
      },
      {
        id: 'support',
        heading: 'Supporting buyers',
        body: [
          'Reply to reasonable buyer questions within a few days and help fix problems with your files. If an order can’t be fixed, the buyer may be refunded under our Refund Policy.',
        ],
      },
      {
        id: 'ending',
        heading: 'Closing your shop',
        body: [
          'You can stop selling at any time. Outstanding earnings are paid out as normal. We may suspend shops that break our policies, and we will explain why and how to appeal.',
        ],
      },
    ],
  },

  'payout-policy': {
    title: 'Payout Policy',
    summary: 'How and when sellers get paid.',
    description: `How ${name} collects payments for sellers, when earnings can be withdrawn, payout methods, holds and reversals.`,
    intro: `This policy explains how money moves from a buyer to a seller on ${name}: who collects it, when it becomes yours to withdraw, and what can delay or reverse a payout. It is part of the Seller Agreement.`,
    sections: [
      {
        id: 'how-money-flows',
        heading: 'How money flows',
        body: [
          [
            `A buyer pays at checkout through ${provider}. ${Operator} collects that payment as the seller’s limited payment collection agent.`,
            NO_PLATFORM_FEE
              ? `The full sale price is added to the seller’s balance straight away. We don’t charge sellers a platform fee or commission on sales. A ${PAYOUT_FEE_LABEL} merchant fee is only taken later, when the seller withdraws. Any service fee or tax shown to the buyer at checkout stays with the platform.`
              : `The sale is split straight away: the seller’s ${commissionPercent(1 - COMMISSION_RATE)} is added to their balance and the ${commissionPercent()} platform commission is kept by us. Any service fee or tax shown to the buyer at checkout also stays with the platform.`,
            'Every sale, fee and payout is recorded in the seller’s ledger and shown in Sales history and on the Payouts page.',
          ],
        ],
      },
      {
        id: 'balances',
        heading: 'Your balance',
        body: [
          [
            'Pending payout: what you have earned and not yet been paid.',
            'Completed payouts: what we have already sent to you.',
            'Total earnings: your share of every sale, all time.',
          ],
          'Balances are kept in US dollars, the currency prices are listed in.',
        ],
      },
      {
        id: 'eligibility',
        heading: 'Before you can withdraw',
        body: [
          [
            `Your pending balance must be at least ${minPayout}.`,
            'Your identity must be verified. After your first sale we ask for a photo of both sides of your government ID and a live selfie. This protects buyers and sellers from fraud and is required before any money is sent.',
            'You must add payout details on the Payouts page: a bank account (account number or IBAN) or a mobile wallet or payment account.',
            'Your shop must be in good standing (see Holds below).',
          ],
        ],
      },
      {
        id: 'methods',
        heading: 'Payout methods',
        body: [
          `We can send payouts to a bank account or to ${wallets}. The name on the account should match the name on your verified ID.`,
          'Payout details are encrypted when stored and only shown to you and the team members who send payouts. Changing them doesn’t affect a payout that has already been sent.',
        ],
      },
      {
        id: 'requesting',
        heading: 'Requesting a payout',
        body: [
          [
            'Click Request payout on the Payouts page. You can have one request open at a time.',
            'Our team reviews the request and sends your pending balance, minus the merchant fee, to your saved payout details, usually within 3–5 business days.',
            'If new sales arrive while a request is being processed, they stay in your pending balance for your next payout.',
            'When it’s sent, the payout shows as Paid on the Payouts page with the date and, where available, the transfer reference.',
          ],
        ],
      },
      {
        id: 'merchant-fee',
        heading: 'Merchant fee on withdrawals',
        body: [
          `There is no platform fee on sales. Instead, a merchant fee of ${PAYOUT_FEE_LABEL} is deducted once from each withdrawal, only when you are paid out. It covers the cost of processing buyers’ payments and sending your payout.`,
          [
            `The fee is ${+(PAYOUT_FEE.rate * 100).toFixed(2)}% of the amount you withdraw, rounded to the nearest cent, plus ${formatPrice(PAYOUT_FEE.fixedCents, 'USD')}.`,
            `Example: withdrawing ${minPayout} costs ${formatPrice(payoutFee(MIN_PAYOUT).fee, 'USD')}, so you receive ${formatPrice(payoutFee(MIN_PAYOUT).net, 'USD')}. Withdrawing ${formatPrice(20000, 'USD')} costs ${formatPrice(payoutFee(20000).fee, 'USD')}, so you receive ${formatPrice(payoutFee(20000).net, 'USD')}.`,
            'The Payouts page shows the fee and the exact amount you will receive before you request a payout, and every completed payout shows what was withdrawn, the fee and what was sent.',
            'Nothing is charged while your earnings stay in your balance, and nothing is charged on sales that are refunded.',
          ],
        ],
      },
      {
        id: 'currency-fees',
        heading: 'Currency and transfer fees',
        body: [
          'If your payout is sent in a currency other than US dollars, it is converted at the exchange rate on the day it is sent. Apart from the merchant fee above, we don’t charge anything for sending a payout. Your bank, wallet or payment service may charge its own fee for receiving or converting money, which we don’t control.',
        ],
      },
      {
        id: 'refunds',
        heading: 'Refunds, chargebacks and reversals',
        body: [
          [
            'If an order is refunded under the Refund Policy, the seller’s earnings for that sale are removed from their balance.',
            'If a buyer’s bank reverses a payment (a chargeback), the amount is removed from the seller’s balance while it is resolved. If the seller wins the dispute, it is added back.',
            'If the earnings were already paid out, the amount is deducted from future earnings.',
          ],
        ],
      },
      {
        id: 'holds',
        heading: 'Holds',
        body: [
          'We may hold some or all of a balance, and tell you why, when:',
          [
            'a sale looks fraudulent, or a payment is still being reviewed by the payment provider;',
            'we receive a copyright notice or a buyer complaint about the products those earnings came from;',
            'your identity can’t be verified, or your payout details don’t match your verified identity;',
            'your account is suspended for breaking the Acceptable Use Policy, or the law requires us to.',
          ],
          'Held earnings are released once the issue is resolved. Earnings from sales that turn out to be fraudulent, or from products the seller had no right to sell, are refunded to the buyers instead.',
        ],
      },
      {
        id: 'wrong-details',
        heading: 'Incorrect payout details',
        body: [
          'Please check your payout details carefully. If a payout is sent to details you entered incorrectly, we will help you try to recover it, but we can’t guarantee it and aren’t responsible for the loss. Payouts returned to us by the bank or wallet go back into your pending balance.',
        ],
      },
      {
        id: 'taxes',
        heading: 'Taxes',
        body: [
          'Sellers are responsible for reporting and paying any income tax or other taxes due on their earnings in their own country. Your Sales history and Payouts page give you a record of every sale and payout for your accounts.',
        ],
      },
      {
        id: 'closing',
        heading: 'Closing your shop',
        body: [
          `If you close your shop or your account, any pending balance is paid out as normal once the requirements above are met, even if it is below ${minPayout}. Accounts with a pending balance can’t be deleted until it has been paid.`,
        ],
      },
      {
        id: 'contact',
        heading: 'Questions about a payout',
        body: [`Email ${supportEmail} with your shop name and, if you have one, the payout date. We reply within 1–2 business days.`],
      },
    ],
  },

  copyright: {
    title: 'Copyright & DMCA Policy',
    summary: 'Reporting work that was listed without permission.',
    description: `How to report copyright infringement on ${name}, and how sellers can respond.`,
    intro: 'We respect creators’ rights. They are the reason this marketplace exists. If your work was listed without permission, tell us and we will act quickly.',
    sections: [
      {
        id: 'report',
        heading: 'Reporting infringement',
        body: [
          `Email ${supportEmail} with the subject “Copyright notice” and include:`,
          [
            'a link to the listing on our site, and a link to or description of your original work;',
            'your name, address, phone number and email address;',
            'a statement that you believe in good faith the use is not authorised by you, your agent or the law;',
            'a statement that the information in your notice is accurate and, under penalty of perjury, that you are the owner or authorised to act for the owner;',
            'your physical or electronic signature.',
          ],
        ],
      },
      {
        id: 'what-we-do',
        heading: 'What we do',
        body: ['When we receive a complete notice, we remove or disable the listing, tell the seller, and pay any affected sales out only once the matter is resolved.'],
      },
      {
        id: 'counter-notice',
        heading: 'Counter-notices',
        body: [
          'If you’re a seller and believe your listing was removed by mistake, reply with a counter-notice explaining why you have the right to sell it, with your contact details and signature. We may restore the listing unless the original claimant tells us they have started legal action.',
        ],
      },
      {
        id: 'repeat',
        heading: 'Repeat infringers',
        body: ['Accounts that repeatedly list work they don’t have the rights to are closed.'],
      },
    ],
  },

  licensing: {
    title: 'Licensing',
    summary: 'What you can do with what you buy.',
    description: `The standard licence for products bought on ${name}.`,
    intro: 'Every purchase comes with a licence to use the product. Unless the product page says otherwise, this standard licence applies.',
    sections: [
      {
        id: 'allowed',
        heading: 'You can',
        body: [
          [
            'Use the product in unlimited personal projects.',
            'Use it in projects for your clients or employer, and in products you sell, as long as the original files aren’t passed on in a usable form (for example a printed poster, a website, or a social media post).',
            'Edit, customise and combine it with your own work.',
          ],
        ],
      },
      {
        id: 'not-allowed',
        heading: 'You can’t',
        body: [
          [
            'Resell, share, give away or sublicense the original or edited files, on their own, in a bundle, or on another marketplace.',
            'Use the product in a template, theme or asset that you then sell or distribute to others.',
            'Claim the original work as your own, or use it in a trademark or logo.',
          ],
        ],
      },
      {
        id: 'seller-licences',
        heading: 'Seller-specific licences',
        body: ['Some sellers offer extended or commercial licences. If a product page lists different terms, those terms apply to that product.'],
      },
      {
        id: 'ownership',
        heading: 'Ownership',
        body: ['Buying a licence doesn’t transfer copyright, ownership stays with the seller who made it. Licences can’t be transferred to someone else.'],
      },
    ],
  },

  accessibility: {
    title: 'Accessibility Statement',
    summary: 'Our commitment to an accessible marketplace.',
    description: `How ${name} works to be usable by everyone, and how to report a barrier.`,
    intro: `We want ${name} to work for everyone, including people who use screen readers, keyboard navigation, magnification or reduced motion.`,
    sections: [
      {
        id: 'standard',
        heading: 'Our standard',
        body: ['We aim to meet the Web Content Accessibility Guidelines (WCAG) 2.2 at level AA.'],
      },
      {
        id: 'what-we-do',
        heading: 'What we do',
        body: [
          [
            'Every page can be used with a keyboard, with visible focus outlines.',
            'Images have text alternatives, and form fields have labels and clear error messages.',
            'Animations respect your “reduce motion” setting, and moving content can be paused.',
            'Text and buttons meet colour-contrast guidelines, and pages work when zoomed to 200%.',
          ],
        ],
      },
      {
        id: 'limits',
        heading: 'Known limitations',
        body: ['Product files, images and descriptions are created by independent sellers, so their accessibility can vary. We encourage sellers to add descriptive text and accessible file formats.'],
      },
      {
        id: 'feedback',
        heading: 'Report a barrier',
        body: [`If something doesn’t work for you, email ${supportEmail} with the page and what happened. We aim to reply within 2 business days and fix confirmed issues as a priority.`],
      },
    ],
  },

  security: {
    title: 'Security',
    summary: 'How we protect accounts, payments and files.',
    description: `How ${name} protects your account, payments and purchased files, and how to report a vulnerability.`,
    intro: 'Security is built into how the marketplace works, not added afterwards. Here is what protects you.',
    sections: [
      {
        id: 'accounts',
        heading: 'Accounts',
        body: [
          [
            'Passwords are hashed with bcrypt. We never store or see your password itself.',
            'Sessions use secure, HTTP-only cookies that scripts on the page can’t read.',
            'Repeated failed sign-ins and other abuse are rate-limited automatically.',
          ],
        ],
      },
      {
        id: 'payments',
        heading: 'Payments',
        body: ['Card payments are processed by our payment provider over an encrypted connection. Full card numbers never reach our servers.'],
      },
      {
        id: 'files',
        heading: 'Files and downloads',
        body: [
          [
            'Uploaded files are checked to confirm they really are the type they claim to be.',
            `Purchased files are only delivered through private, signed links tied to your order, limited to ${DOWNLOADS_PER_HOUR} downloads per hour per item to stop shared links being abused.`,
            'Every listing is reviewed before it goes live.',
          ],
        ],
      },
      {
        id: 'infrastructure',
        heading: 'Infrastructure',
        body: ['The site is served only over HTTPS, and data is stored with a managed database provider that encrypts it at rest. Access to production systems is limited to the people who need it.'],
      },
      {
        id: 'disclosure',
        heading: 'Reporting a vulnerability',
        body: [
          `If you believe you’ve found a security issue, email ${supportEmail} with the subject “Security” and the steps to reproduce it. Please don’t access other people’s data or disrupt the service while testing. We will confirm receipt within 2 business days and keep you updated until it is fixed.`,
        ],
      },
    ],
  },
};

/** /how-it-works — buying, selling and our product review methodology. */
export const HOW_IT_WORKS = {
  title: 'How It Works',
  description: `How buying and selling on ${name} works, and the methodology we use to review every listing.`,
  intro: `${name} is a marketplace for digital products, physical goods and services from independent creators, run by ${operator}. Here is how it all fits together.`,
  sections: [
    {
      id: 'buying',
      heading: 'Buying',
      body: [
        [
          'Browse by category (main, sub and inner) or search for exactly what you need.',
          'Message the seller with any questions before you buy.',
          'Pay securely at checkout. Digital files are ready to download immediately, and stay in your account for lifetime re-downloads.',
        ],
      ],
    },
    {
      id: 'selling',
      heading: 'Selling',
      body: [
        [
          'Open a free shop and create a listing: photos, description, price, category and your files or delivery details.',
          'Submit it for review. Once approved, it goes live in its category and search.',
          NO_PLATFORM_FEE
            ? `Get paid for every sale. We don’t take a commission on sales; a ${PAYOUT_FEE_LABEL} merchant fee is deducted only when you withdraw your earnings (from ${minPayout}).`
            : `Get paid for every sale. You keep ${commissionPercent(1 - COMMISSION_RATE)}.`,
        ],
      ],
    },
    {
      id: 'review-methodology',
      heading: 'Our review methodology',
      body: [
        'Every new listing and every edit is checked by a person before it is published. We look at:',
        [
          'Rights: does the seller appear to own or have the right to sell this? We look for copied work, resold assets and brand misuse.',
          'Accuracy: do the title, description, photos and file formats match what the buyer will receive?',
          'Files: do uploads open, match their declared type and contain nothing harmful? Links must point to the real product.',
          'Category: is it listed in the category that fits best?',
          'Policy: does it follow our Acceptable Use Policy?',
        ],
        'Listings that pass go live. If we decline one, it shows as Rejected in the seller’s dashboard; the seller can contact us to find out why, fix it and resubmit.',
      ],
    },
    {
      id: 'ranking',
      heading: 'How listings are ordered',
      body: [
        'Search and category pages are ordered by relevance to your search, then by what you choose: newest, most popular, or price. Sellers can’t pay to rank higher, and we don’t sell placement.',
      ],
    },
    {
      id: 'reviews',
      heading: 'Reviews',
      body: ['Only buyers who purchased a product can review it, and reviews are shown with the reviewer’s first name and initial. We don’t edit reviews, but we remove ones that break our rules.'],
    },
    {
      id: 'protection',
      heading: 'Buyer protection',
      body: ['If a product is faulty or not as described, our Refund Policy covers you. Contact us within 14 days of purchase.'],
    },
  ],
};

export const POLICY_UPDATED = UPDATED;
