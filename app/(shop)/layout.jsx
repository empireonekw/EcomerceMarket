import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import CartDrawer from '@/components/CartDrawer';
import { AuthProvider } from '@/context/AuthContext';
import { CartProvider } from '@/context/CartContext';
import ShopMessaging from '@/components/messages/ShopMessaging';

/** Storefront chrome. The (shop) route group doesn't affect URLs. */
export default function ShopLayout({ children }) {
  return (
    // Client providers; Server Components passed as children stay server-rendered (and static where possible).
    <AuthProvider>
      <ShopMessaging>
        <CartProvider>
          <Navbar />
          <main id="main" className="flex-1">
            {children}
          </main>
          <Footer />
          <CartDrawer />
        </CartProvider>
      </ShopMessaging>
    </AuthProvider>
  );
}
