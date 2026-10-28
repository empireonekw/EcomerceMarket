// Account validation rules shared by the auth forms (client) and API routes (server),
// so both always agree. Each validator returns an error message or null.

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const PASSWORD_MIN = 8;
const PASSWORD_MAX_BYTES = 72; // bcrypt ignores everything past 72 bytes — reject instead of silently truncating

export function validateName(name) {
  const v = String(name ?? '').trim();
  if (!v) return 'Please enter your name.';
  if (v.length < 2) return 'Name must be at least 2 characters.';
  if (v.length > 80) return 'Name must be 80 characters or fewer.';
  return null;
}

export function validateEmail(email) {
  const v = String(email ?? '').trim();
  if (!v) return 'Please enter your email.';
  if (v.length > 254 || !EMAIL_RE.test(v)) return 'Please enter a valid email address.';
  return null;
}

/** Password requirements — rendered as a live checklist in the UI and enforced by validatePassword(). */
export const PASSWORD_RULES = [
  { id: 'length', label: `At least ${PASSWORD_MIN} characters`, test: (v) => v.length >= PASSWORD_MIN },
  { id: 'upper', label: 'One uppercase letter', test: (v) => /[A-Z]/.test(v) },
  { id: 'number', label: 'One number', test: (v) => /\d/.test(v) },
  { id: 'special', label: 'One special character', test: (v) => /[^A-Za-z0-9]/.test(v) },
];

export function validatePassword(password, { email } = {}) {
  const v = String(password ?? '');
  if (!v) return 'Please enter a password.';
  const unmet = PASSWORD_RULES.find((rule) => !rule.test(v));
  if (unmet) return `Password needs: ${unmet.label.toLowerCase()}.`;
  if (new TextEncoder().encode(v).length > PASSWORD_MAX_BYTES) return 'Password is too long (max 72 bytes).';
  if (email && v.toLowerCase() === String(email).trim().toLowerCase()) return 'Password can’t be your email address.';
  return null;
}

export const normalizeEmail = (email) => String(email ?? '').trim().toLowerCase();

// ---------------------------------------------------------------------------
// Seller onboarding
// ---------------------------------------------------------------------------

export const WALLET_OPTIONS = [
  { value: 'easypaisa', label: 'EasyPaisa' },
  { value: 'jazzcash', label: 'JazzCash' },
];

const IBAN_RE = /^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/; // e.g. PK36SCBL0000001123456702
const ACCOUNT_NO_RE = /^\d{8,24}$/;
const PK_MOBILE_RE = /^(?:\+92|0)3\d{9}$/; // 03XXXXXXXXX or +923XXXXXXXXX

export const STORE_DESCRIPTION_LIMITS = { min: 20, max: 500 };

/** Product review text length (models/Review.js, review form). */
export const REVIEW_LIMITS = { min: 20, max: 600 };

/** Contact form (models/ContactMessage.js, components/ContactForm.jsx). Returns { field: message }. */
export const CONTACT_LIMITS = { min: 10, max: 2000 };

/** Buyer ↔ seller messages (models/Message.js, the inbox composer). */
export const MESSAGE_LIMITS = { max: 2000, label: 30, labels: 20, autoReply: 500 };

export function validateContactMessage({ name, email, message } = {}) {
  const errors = {};
  const nameError = validateName(name);
  if (nameError) errors.name = nameError;
  const emailError = validateEmail(email);
  if (emailError) errors.email = emailError;
  const v = String(message ?? '').trim();
  if (!v) errors.message = 'Please write your message.';
  else if (v.length < CONTACT_LIMITS.min) errors.message = `Write at least ${CONTACT_LIMITS.min} characters.`;
  else if (v.length > CONTACT_LIMITS.max) errors.message = `Keep it under ${CONTACT_LIMITS.max} characters.`;
  return errors;
}

export function validateStoreDescription(text) {
  const v = String(text ?? '').trim();
  if (!v) return 'Tell buyers what your shop offers.';
  if (v.length < STORE_DESCRIPTION_LIMITS.min) return `Write at least ${STORE_DESCRIPTION_LIMITS.min} characters.`;
  if (v.length > STORE_DESCRIPTION_LIMITS.max) return `Keep it under ${STORE_DESCRIPTION_LIMITS.max} characters.`;
  return null;
}

export function validateStoreName(name) {
  const v = String(name ?? '').trim();
  if (!v) return 'Please enter a store name.';
  if (v.length < 3) return 'Store name must be at least 3 characters.';
  if (v.length > 60) return 'Store name must be 60 characters or fewer.';
  if (!/^[\p{L}\p{N}][\p{L}\p{N} .&'-]*$/u.test(v)) return 'Use letters, numbers, spaces and . & \' - only.';
  return null;
}

/** Normalises whitespace/case the same way on client and server. */
export function normalizeBankDetails(input = {}) {
  const clean = (v) => String(v ?? '').trim().replace(/\s+/g, ' ');
  return {
    bankName: clean(input.bankName),
    accountTitle: clean(input.accountTitle),
    accountNumber: clean(input.accountNumber).replace(/[\s-]/g, '').toUpperCase(),
    walletProvider: clean(input.walletProvider).toLowerCase(),
    walletNumber: clean(input.walletNumber).replace(/[\s-]/g, ''),
  };
}

/**
 * A seller needs at least one complete payout method: a bank account (all three fields)
 * and/or a mobile wallet (provider + number). Returns a field → message map ({} when valid).
 */
export function validateBankDetails(input) {
  const d = normalizeBankDetails(input);
  const errors = {};
  const bankStarted = Boolean(d.bankName || d.accountTitle || d.accountNumber);
  const walletStarted = Boolean(d.walletProvider || d.walletNumber);

  if (!bankStarted && !walletStarted) {
    errors.payoutMethod = 'Add a bank account or a mobile wallet so we can pay you.';
    return errors;
  }
  if (bankStarted) {
    if (d.bankName.length < 2) errors.bankName = 'Enter your bank’s name.';
    if (d.accountTitle.length < 2) errors.accountTitle = 'Enter the account title (name on the account).';
    if (!IBAN_RE.test(d.accountNumber) && !ACCOUNT_NO_RE.test(d.accountNumber)) {
      errors.accountNumber = 'Enter a valid IBAN (e.g. PK36SCBL0000001123456702) or account number.';
    }
  }
  if (walletStarted) {
    if (!WALLET_OPTIONS.some((w) => w.value === d.walletProvider)) errors.walletProvider = 'Choose EasyPaisa or JazzCash.';
    if (!PK_MOBILE_RE.test(d.walletNumber)) errors.walletNumber = 'Enter a mobile number like 03001234567.';
  }
  return errors;
}
