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
    <html lang="vi" dir="ltr">
      <body className="antialiased">
        <SkipNav />
        {children}
      </body>
    </html>
  );
}
