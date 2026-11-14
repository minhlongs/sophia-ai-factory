import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { SkipNav } from '@/components/skip-nav';
import { ZenThemeProvider } from '@/forest/theme/zen-theme-provider';
import { SUPPORTED_LOCALES } from '@/middleware/middleware-shared-config';
import { getCspNonce } from '@/seed/security/get-csp-nonce';
import { isRtlLocale } from '@/seed/types/edge-mesh';
import './globals.css';

export const metadata: Metadata = {
  // Required so relative og:image/twitter:image URLs (e.g. /og-image.png)
  // resolve against the production domain instead of http://localhost:3000.
  metadataBase: new URL('https://sophia.agencyos.network'),
  title: 'Sophia AI Factory — AI Video Generation Platform',
  description:
    'Generate AI-powered videos for faceless YouTube channels and affiliate marketing empires.',
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Middleware mints a per-request nonce and emits `script-src 'nonce-…'`
  // without `'unsafe-inline'`. `next-themes` restores the saved theme with an
  // inline script before paint, so the same nonce must reach it — otherwise the
  // script is blocked and a light-mode user flashes the dark default on load.
  const nonce = await getCspNonce();
  let locale = 'vi';
  try {
    const headerList = await headers();
    const candidate = headerList.get('x-next-intl-locale');
    if (
      candidate &&
      (SUPPORTED_LOCALES as readonly string[]).includes(candidate)
    ) {
      locale = candidate;
    }
  } catch {
    // Non-request build-time prerender contexts fall back safely to 'vi'.
  }
  const dir = isRtlLocale(locale) ? 'rtl' : 'ltr';

  return (
    <html lang={locale} dir={dir} className="dark" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@100..112,400..800&family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased bg-background text-foreground selection:bg-indigo-500/30 selection:text-indigo-200 min-h-screen">
        <ZenThemeProvider defaultTheme="dark" nonce={nonce}>
          <SkipNav />
          {children}
        </ZenThemeProvider>
      </body>
    </html>
  );
}

