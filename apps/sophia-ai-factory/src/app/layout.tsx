import type { Metadata } from 'next';
import { SkipNav } from '@/components/skip-nav';
import './globals.css';

export const metadata: Metadata = {
  // Required so relative og:image/twitter:image URLs (e.g. /og-image.png)
  // resolve against the production domain instead of http://localhost:3000.
  metadataBase: new URL('https://sophia.agencyos.network'),
  title: 'Sophia AI Factory — AI Video Generation Platform',
  description:
    'Generate AI-powered videos for faceless YouTube channels and affiliate marketing empires.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi" dir="ltr" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;1,400&family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased bg-background text-foreground selection:bg-indigo-500/30 selection:text-indigo-200 min-h-screen">
        <SkipNav />
        {children}
      </body>
    </html>
  );
}

