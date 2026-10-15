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
