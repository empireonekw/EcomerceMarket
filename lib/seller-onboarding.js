// Seller onboarding wizard (/sell-on-sellpify): steps, options and validation shared by the wizard (client) and the
// onboarding API (server), so both always agree. Relative imports: plain-Node scripts load the models that use this.
import { z } from 'zod';
import { isAllowedImageUrl, isLocalMediaPath } from './image-hosts.js';
import { validateBankDetails, validateStoreDescription, validateStoreName } from './validation.js';

export const ONBOARDING_PATH = '/sell-on-sellpify';

/** The wizard's steps, in order. Adding products ("stock your shop") is left for the dashboard, so shops open fast. */
export const ONBOARDING_STEPS = [
  { id: 'preferences', label: 'Shop preferences' },
  { id: 'identity', label: 'Name your shop' },
  { id: 'billing', label: 'Billing info' },
  { id: 'payout', label: 'How you’ll get paid' },
  { id: 'review', label: 'Review & submit' },
];

// ISO code, name, phone prefix and usual currency. Pakistan first: most sellers are there.
export const COUNTRIES = [
  ['PK', 'Pakistan', '+92', 'PKR'],
  ['AE', 'United Arab Emirates', '+971', 'AED'],
  ['SA', 'Saudi Arabia', '+966', 'SAR'],
  ['GB', 'United Kingdom', '+44', 'GBP'],
  ['US', 'United States', '+1', 'USD'],
  ['CA', 'Canada', '+1', 'CAD'],
  ['AU', 'Australia', '+61', 'AUD'],
  ['AF', 'Afghanistan', '+93', 'USD'],
  ['AT', 'Austria', '+43', 'EUR'],
  ['BD', 'Bangladesh', '+880', 'BDT'],
  ['BE', 'Belgium', '+32', 'EUR'],
  ['BH', 'Bahrain', '+973', 'USD'],
  ['BR', 'Brazil', '+55', 'USD'],
  ['CH', 'Switzerland', '+41', 'EUR'],
  ['CN', 'China', '+86', 'USD'],
  ['DE', 'Germany', '+49', 'EUR'],
  ['DK', 'Denmark', '+45', 'EUR'],
  ['EG', 'Egypt', '+20', 'USD'],
  ['ES', 'Spain', '+34', 'EUR'],
  ['FI', 'Finland', '+358', 'EUR'],
  ['FR', 'France', '+33', 'EUR'],
  ['GR', 'Greece', '+30', 'EUR'],
  ['HK', 'Hong Kong', '+852', 'USD'],
  ['ID', 'Indonesia', '+62', 'USD'],
  ['IE', 'Ireland', '+353', 'EUR'],
  ['IN', 'India', '+91', 'INR'],
  ['IT', 'Italy', '+39', 'EUR'],
  ['JO', 'Jordan', '+962', 'USD'],
  ['JP', 'Japan', '+81', 'USD'],
  ['KE', 'Kenya', '+254', 'USD'],
  ['KR', 'South Korea', '+82', 'USD'],
  ['KW', 'Kuwait', '+965', 'USD'],
  ['LK', 'Sri Lanka', '+94', 'USD'],
  ['MA', 'Morocco', '+212', 'USD'],
  ['MX', 'Mexico', '+52', 'USD'],
  ['MY', 'Malaysia', '+60', 'MYR'],
  ['NG', 'Nigeria', '+234', 'USD'],
  ['NL', 'Netherlands', '+31', 'EUR'],
  ['NO', 'Norway', '+47', 'EUR'],
  ['NP', 'Nepal', '+977', 'USD'],
  ['NZ', 'New Zealand', '+64', 'AUD'],
  ['OM', 'Oman', '+968', 'USD'],
  ['PH', 'Philippines', '+63', 'USD'],
  ['PL', 'Poland', '+48', 'EUR'],
  ['PT', 'Portugal', '+351', 'EUR'],
  ['QA', 'Qatar', '+974', 'QAR'],
  ['SE', 'Sweden', '+46', 'EUR'],
  ['SG', 'Singapore', '+65', 'SGD'],
  ['TH', 'Thailand', '+66', 'USD'],
  ['TR', 'Türkiye', '+90', 'TRY'],
  ['VN', 'Vietnam', '+84', 'USD'],
  ['ZA', 'South Africa', '+27', 'USD'],
].map(([code, name, dial, currency]) => ({ code, name, dial, currency }));
export const countryOf = (code) => COUNTRIES.find((c) => c.code === code);
/** Phone prefixes, one per prefix (+1 serves both the US and Canada). */
export const DIAL_CODES = [...new Set(COUNTRIES.map((c) => c.dial))];

export const CURRENCIES = [
  { value: 'USD', label: '$ United States Dollar' },
  { value: 'PKR', label: 'Rs Pakistani Rupee' },
  { value: 'EUR', label: '€ Euro' },
  { value: 'GBP', label: '£ British Pound' },
  { value: 'AED', label: 'AED UAE Dirham' },
  { value: 'SAR', label: 'SAR Saudi Riyal' },
  { value: 'QAR', label: 'QAR Qatari Riyal' },
  { value: 'CAD', label: 'CA$ Canadian Dollar' },
  { value: 'AUD', label: 'A$ Australian Dollar' },
  { value: 'INR', label: '₹ Indian Rupee' },
  { value: 'BDT', label: '৳ Bangladeshi Taka' },
  { value: 'MYR', label: 'RM Malaysian Ringgit' },
  { value: 'SGD', label: 'S$ Singapore Dollar' },
  { value: 'TRY', label: '₺ Turkish Lira' },
];

const values = (list, key = 'value') => list.map((o) => o[key]);
const PRIVATE_UPLOAD_RE = /^uploads\/private\/[\w.-]+\.(?:jpe?g|png|pdf)$/;
const BLOB_RE = /^https:\/\/[^/]+\.public\.blob\.vercel-storage\.com\/[\w./-]+\.(?:jpe?g|png|pdf)$/;
/** An ID document uploaded here (private: only the seller and admins can open it). */
export const isIdDocument = (v) => PRIVATE_UPLOAD_RE.test(String(v ?? '')) || BLOB_RE.test(String(v ?? ''));
/** A shop logo or banner uploaded here (public media). */
const isShopImage = (v) => (isLocalMediaPath(v) || /^https:\/\//.test(v)) && isAllowedImageUrl(v);

const text = (max, message) => z.string().trim().max(max, message);
const refineWith = (check) => (v, ctx) => {
  const message = check(v);
  if (message) ctx.addIssue({ code: 'custom', message });
};

/** Each step's rules. A step's data is saved only when it passes (both in the browser and on the server). */
export const STEP_SCHEMAS = {
  preferences: z.object({
    country: z.enum(values(COUNTRIES, 'code'), 'Choose where your shop is based.'),
    currency: z.enum(values(CURRENCIES), 'Choose your shop currency.'),
  }),
  identity: z.object({
    storeName: z.string().trim().superRefine(refineWith(validateStoreName)),
    // Optional here (it can be written later in Shop settings), but when given it follows the usual rules.
    storeDescription: z
      .string()
      .trim()
      .max(500)
      .default('')
      .superRefine(refineWith((v) => (v ? validateStoreDescription(v) : null))),
    logo: z
      .string()
      .default('')
      .refine((v) => !v || isShopImage(v), 'Upload the logo again.'),
    banner: z
      .string()
      .default('')
      .refine((v) => !v || isShopImage(v), 'Upload the banner again.'),
  }),
  // Identity (ID card + selfie) isn't asked here: it comes after the first sale (IDENTITY_SCHEMA, /seller/verify).
  billing: z.object({
    address: z.object({
      line1: text(120, 'Keep it under 120 characters.').min(4, 'Enter your street address.'),
      line2: text(120, 'Keep it under 120 characters.').default(''),
      city: text(60, 'Keep it under 60 characters.').min(2, 'Enter your city.'),
      state: text(60, 'Keep it under 60 characters.').min(2, 'Enter your state or province.'),
      postalCode: z
        .string()
        .trim()
        .regex(/^[A-Za-z0-9][A-Za-z0-9 -]{1,9}$/, 'Enter a valid postal code.'),
    }),
    phone: z.object({
      dial: z.enum(DIAL_CODES, 'Choose your country code.'),
      number: z
        .string()
        .transform((v) => v.replace(/[\s()-]/g, '').replace(/^0+/, ''))
        .pipe(z.string().regex(/^\d{6,14}$/, 'Enter your phone number without the country code.')),
    }),
  }),
  // One payout method: a bank account, or a wallet / payment service (lib/validation.js validateBankDetails) — or
  // 'later': optional at shop opening, added from Payouts & Bank Details before the first payout.
  payout: z
    .object({
      method: z.enum(['bank', 'wallet', 'later'], 'Choose how you’d like to be paid, or add it later.'),
      bankName: z.string().default(''),
      accountTitle: z.string().default(''),
      accountNumber: z.string().default(''),
      walletProvider: z.string().default(''),
      walletNumber: z.string().default(''),
    })
    .superRefine((v, ctx) => {
      if (v.method === 'later') return;
      const only =
        v.method === 'bank'
          ? { bankName: v.bankName, accountTitle: v.accountTitle, accountNumber: v.accountNumber }
          : { walletProvider: v.walletProvider, walletNumber: v.walletNumber };
      const errors = validateBankDetails(only);
      if (errors.payoutMethod) errors[v.method === 'bank' ? 'bankName' : 'walletProvider'] = errors.payoutMethod;
      for (const [field, message] of Object.entries(errors)) if (field !== 'payoutMethod') ctx.addIssue({ code: 'custom', path: [field], message });
    }),
  review: z.object({
    agreeTerms: z.literal(true, 'Please agree to the Seller Terms to open your shop.'),
  }),
};

/** A selfie must be a photo (taken with the camera as a JPG), never a PDF. */
const isIdPhoto = (v) => isIdDocument(v) && !/\.pdf$/i.test(String(v));

/** The identity check after the first sale: both sides of the ID card and a live selfie. */
export const IDENTITY_SCHEMA = z.object({
  idFront: z.string({ error: 'Add the front of your ID card.' }).refine(isIdDocument, 'Add the front of your ID card.'),
  idBack: z.string({ error: 'Add the back of your ID card.' }).refine(isIdDocument, 'Add the back of your ID card.'),
  selfie: z.string({ error: 'Take a selfie with your camera.' }).refine(isIdPhoto, 'Take a selfie with your camera.'),
});

/** True when an admin has verified this seller's identity (`user.seller`); shown as a blue tick next to their name. */
export const isVerifiedSeller = (seller) => seller?.verification?.status === 'verified';

/** Zod issues → { "address.city": message } (the first message per field), for the forms. */
export function fieldErrors(error) {
  const out = {};
  for (const issue of error?.issues ?? []) {
    const key = issue.path.join('.') || '_';
    out[key] ??= issue.message;
  }
  return out;
}

/** { ok: true, data } or { ok: false, errors } for one step. */
export function checkStep(step, input) {
  const schema = STEP_SCHEMAS[step];
  if (!schema) return { ok: false, errors: { _: 'Unknown step.' } };
  const result = schema.safeParse(input ?? {});
  return result.success ? { ok: true, data: result.data } : { ok: false, errors: fieldErrors(result.error) };
}

/** An empty draft: what the wizard starts from. */
export const EMPTY_ONBOARDING = {
  preferences: { country: 'PK', currency: 'USD' },
  identity: { storeName: '', storeDescription: '', logo: '', banner: '' },
  billing: {
    address: { line1: '', line2: '', city: '', state: '', postalCode: '' },
    phone: { dial: '+92', number: '' },
  },
  payout: { method: '', bankName: '', accountTitle: '', accountNumber: '', walletProvider: '', walletNumber: '' },
};
