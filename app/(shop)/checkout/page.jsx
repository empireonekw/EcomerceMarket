import CheckoutForm from '@/components/CheckoutForm';
import { isDemoCheckout } from '@/lib/payments';

export const metadata = { title: 'Checkout', robots: { index: false } };

export default function CheckoutPage() {
  return (
    <div className="container-page py-12 sm:py-16">
      <h1 className="headline text-4xl sm:text-5xl">Checkout</h1>
      <div className="mt-8">
        <CheckoutForm demoMode={isDemoCheckout()} />
      </div>
    </div>
  );
}
