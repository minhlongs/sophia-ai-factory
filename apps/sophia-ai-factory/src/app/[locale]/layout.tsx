import type { Metadata, Viewport } from "next";
import dynamic from "next/dynamic";
import localFont from "next/font/local";
import "../globals.css";
import { Navbar } from "@/app/components/layout/navbar";
import { QueryProvider } from "@/components/providers/query-provider";

import { ThemeProvider } from "@/components/providers/theme-provider";
import { MockModeIndicator } from "@/components/dev/mock-mode-indicator";
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';

const Toaster = dynamic(
  () => import("sonner").then(m => ({ default: m.Toaster }))
);
const FloatingHelpButton = dynamic(
  () => import("@/components/guide/floating-help-button").then(m => ({ default: m.FloatingHelpButton }))
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
  title: "Sophia AI Video Factory - Automate Your Content Empire",
  description: "Turn content into empire. The ultimate AI video creation workflow with automated affiliate discovery, ROI calculator, and 3-tier pricing. Build, scale, and monetize your YouTube channels effortlessly.",
  keywords: [
    "AI video creation",
    "YouTube automation",
    "affiliate marketing",
    "content automation",
    "video factory",
    "AI content",
    "no-code tools",
    "ROI calculator",
  ],
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
    siteName: "Sophia AI Factory",
  },
  twitter: {
    card: "summary_large_image",
    title: "Sophia AI Video Factory - Automate Your Content Empire",
    description: "The ultimate AI video creation workflow. Build, scale, and monetize your YouTube channels with automation.",
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

  return (
    <html lang={locale} className="dark">
      <head>
        <link rel="preconnect" href="https://api.polar.sh" />
        <link rel="dns-prefetch" href="https://api.polar.sh" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-[100] focus:top-4 focus:left-4 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md focus:outline-none">
          Skip to main content
        </a>
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
            </QueryProvider>
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
