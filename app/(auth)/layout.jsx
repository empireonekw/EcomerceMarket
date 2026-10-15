import AuthBackground from '@/components/auth/AuthBackground';
import { AuthProvider } from '@/context/AuthContext';

/** Standalone auth pages (login, signup, password help): no store chrome, animated backdrop. */
export default function AuthLayout({ children }) {
  return (
    <AuthProvider>
      <AuthBackground />
      <main id="main" className="relative flex-1">
        {children}
      </main>
    </AuthProvider>
  );
}
