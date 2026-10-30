import { Suspense } from 'react';
import { Fraunces, Inter } from 'next/font/google';

import NavigationProgress from '@/components/NavigationProgress';
import { REVEAL_SCRIPT } from '@/components/Reveal';
import { siteConfig } from '@/lib/site';

import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

// Editorial serif for the homepage hero headline (variable font: every weight, plus optical sizing for large text).
const fraunces = Fraunces({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-fraunces',
  axes: ['opsz'],
  style: ['normal', 'italic'],
});

export const metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: `${siteConfig.name} | Templates, E-books, Software & Vectors`,
    template: `%s | ${siteConfig.name}`,
  },
  description: siteConfig.description,
  verification: {
    google: '0i7FeCq6qfqS25NS3eUoaN-dCwcAQJYTkPnj1u_Wzl0',
  },
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
    <html lang="en" className={`${inter.variable} ${fraunces.variable}`} suppressHydrationWarning>
      <head>
        {/* Scroll reveals start as soon as the HTML arrives, not after the JS bundle (components/Reveal.jsx). */}
        <script dangerouslySetInnerHTML={{ __html: REVEAL_SCRIPT }} />
      </head>
      <body className="flex min-h-dvh flex-col font-sans">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-ink focus:px-4 focus:py-2 focus:text-white"
        >
          Skip to content
        </a>
        {/* Reads the search params, so it sits in its own Suspense boundary and never holds back static pages. */}
        <Suspense fallback={null}>
          <NavigationProgress />
        </Suspense>
        {children}
      </body>
    </html>
  );
}