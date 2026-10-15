import { Inter } from 'next/font/google';
import { siteConfig } from '@/lib/site';
import './globals.css';

const inter = Inter({ subsets: ['latin'], display: 'swap', variable: '--font-inter' });

export const metadata = {
  metadataBase: new URL(siteConfig.url),
  title: { default: `${siteConfig.name} — Templates, E-books, Software & Vectors`, template: `%s | ${siteConfig.name}` },
  description: siteConfig.description,
  openGraph: {
    type: 'website',
    siteName: siteConfig.name,
    title: siteConfig.name,
    description: siteConfig.description,
    url: '/',
  },
  twitter: { card: 'summary_large_image' },
  robots: { index: true, follow: true },
};

export const viewport = {
  themeColor: '#ffffff',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="flex min-h-dvh flex-col font-sans">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-ink focus:px-4 focus:py-2 focus:text-white"
        >
          Skip to content
        </a>
        {/* Each area brings its own chrome: app/(shop)/layout.jsx (storefront) and app/admin/layout.js (portal). */}
        {children}
      </body>
    </html>
  );
}
