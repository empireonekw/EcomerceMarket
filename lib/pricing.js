// Shared by the cart UI (client) and order creation (server), so the summary a buyer
// sees is computed exactly the way the server charges. All amounts are integer cents.

const taxRate = Math.max(0, Number(process.env.NEXT_PUBLIC_TAX_RATE) || 0); // e.g. 0.08 = 8%
const serviceFeeCents = Math.max(0, Math.round(Number(process.env.NEXT_PUBLIC_SERVICE_FEE_CENTS) || 0));

export const PRICING = { taxRate, serviceFeeCents };

export function calculateTotals(subtotal) {
  const fee = subtotal > 0 ? serviceFeeCents : 0; // free orders stay free
  const tax = Math.round(subtotal * taxRate);
  return { subtotal, fee, tax, total: subtotal + fee + tax };
}

export function formatTaxRate() {
  return `${+(taxRate * 100).toFixed(2)}%`;
}

// ---- Local currency (PayFast charges in Pakistani rupees) -----------------------------------------------------------
// Prices are kept in USD across the site; at checkout the total is converted at this rate and charged in PKR.
// NEXT_PUBLIC_USD_TO_PKR is inlined at build time (update it and redeploy to change the rate).
const usdToPkr = Number(process.env.NEXT_PUBLIC_USD_TO_PKR) > 0 ? Number(process.env.NEXT_PUBLIC_USD_TO_PKR) : 280;

export const CHARGE_CURRENCY = 'PKR';

/** What a buyer is charged for `cents` of `currency`: { paisa, rate }. Rounded up to a whole rupee. */
export function chargeAmount(cents, currency = 'USD') {
  const rate = currency === CHARGE_CURRENCY ? 1 : usdToPkr;
  return { paisa: Math.ceil((cents * rate) / 100) * 100, rate };
}

const pkrFormatter = new Intl.NumberFormat('en-PK', { maximumFractionDigits: 0 });
/** "Rs 2,800" */
export const formatPkr = (paisa) => `Rs ${pkrFormatter.format(Math.round(paisa / 100))}`;
