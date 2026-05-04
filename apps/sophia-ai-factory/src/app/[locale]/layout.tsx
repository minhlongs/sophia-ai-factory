import type { Metadata, Viewport } from "next";
import dynamic from "next/dynamic";
import localFont from "next/font/local";
import "../globals.css";
import { Navbar } from "@/app/components/layout/navbar";
import { QueryProvider } from "@/forest/components/providers/query-provider";
import { PostHogProvider } from "@/forest/components/posthog-provider";

import { ThemeProvider } from "@/forest/components/providers/theme-provider";
import { MockModeIndicator } from "@/forest/components/dev/mock-mode-indicator";
import { ErrorReporter } from "@/forest/components/providers/error-reporter";
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { getCspNonce } from '@/seed/security/get-csp-nonce';
import { buildOrganizationSchema } from '@/lib/seo/schema-org';

// JSON-LD schema — explicit type to avoid TypeScript stack overflow
const JSONLD_SCHEMA: Record<string, unknown> = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "Sophia AI Factory",
  "applicationCategory": "MultimediaApplication",
  "operatingSystem": "Web",
  "url": "https://sophia.agencyos.network",
  "description": "AI Video Factory — SaaS platform for automated AI video creation. Create professional videos with HeyGen avatars, ElevenLabs voice, and 100+ AI models.",
  "offers": {
    "@type": "AggregateOffer",
    "lowPrice": "199",
    "highPrice": "4999",
    "priceCurrency": "USD",
    "offerCount": "4"
  },
  "provider": {
    "@type": "Organization",
    "name": "Sophia AI Factory",
    "url": "https://sophia.agencyos.network"
  }
};

const Toaster = dynamic(
  () => import("sonner").then(m => ({ default: m.Toaster }))
);
const FloatingHelpButton = dynamic(
  () => import("@/forest/components/guide/floating-help-button").then(m => ({ default: m.FloatingHelpButton }))
);

const geistSans = localFont({
  src: "../fonts/GeistVF.woff2",
  variable: "--font-geist-sans",
  weight: "100 900",
});

const geistMono = localFont({
  src: "../fonts/GeistMonoVF.woff2",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://sophia.agencyos.network"),
  title: "Sophia AI Video Factory - Automate Your Content Empire",
  description: "Sophia: AI video factory + USDT payouts for global creators. 9 affiliate networks, 6 channels (YT/TikTok/IG/Pinterest/LinkedIn/Zalo). From $199.",
  manifest: "/manifest.json",
  authors: [{ name: "Sophia AI Factory" }],
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Sophia AI Factory",
  },
  openGraph: {
    title: "Sophia AI Video Factory - Automate Your Content Empire",
    description: "The ultimate AI video creation workflow. Build, scale, and monetize your YouTube channels with automation.",
    type: "website",
    locale: "en_US",
    alternateLocale: "vi_VN",
    siteName: "Sophia AI Factory",
    url: "https://sophia.agencyos.network",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "Sophia AI Video Factory" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Sophia AI Video Factory - Automate Your Content Empire",
    description: "The ultimate AI video creation workflow. Build, scale, and monetize your YouTube channels with automation.",
    images: ["/og-image.png"],
  },
  alternates: {
    canonical: "https://sophia.agencyos.network",
    languages: {
      "en": "https://sophia.agencyos.network/en",
      "vi": "https://sophia.agencyos.network/vi",
      "x-default": "https://sophia.agencyos.network/en",
    },
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#000000",
};

export default async function RootLayout({
  children,
  params
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;
  const messages = await getMessages();
  const nonce = await getCspNonce();

  return (
    <html lang={locale} className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0&display=swap"
        />
        <link rel="preconnect" href="https://api.nowpayments.io" />
        <link rel="dns-prefetch" href="https://api.nowpayments.io" />
        <script
          type="application/ld+json"
          nonce={nonce}
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(JSONLD_SCHEMA),
          }}
        />
        <script
          type="application/ld+json"
          nonce={nonce}
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(buildOrganizationSchema()),
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-[100] focus:top-4 focus:left-4 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md focus:outline-none">
          Skip to main content
        </a>
        <PostHogProvider>
        <NextIntlClientProvider messages={messages}>
          <ThemeProvider
            attribute="class"
            defaultTheme="dark"
            forcedTheme="dark"
            disableTransitionOnChange
          >
            <QueryProvider>
              <Navbar />
              {children}
              <MockModeIndicator />
              <FloatingHelpButton />
              <Toaster />
              <ErrorReporter />
            </QueryProvider>
          </ThemeProvider>
        </NextIntlClientProvider>
        </PostHogProvider>
      </body>
    </html>
  );
}
