import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/components/auth/auth-provider";
import { ToastProvider } from "@/components/ui/toast-provider";

const SITE_URL = "https://sophia.agencyos.network";
const SITE_TITLE = "Sophia AI Factory — Robot-as-a-Service Platform";
const SITE_DESCRIPTION =
  "Deploy autonomous AI agents via API. Generate proposals, hunt leads, send emails, and create content — all powered by MCU credits with transparent pricing.";
const OG_IMAGE = `${SITE_URL}/og-image.png`;

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: "Sophia AI Factory",
      url: SITE_URL,
      logo: {
        "@type": "ImageObject",
        url: `${SITE_URL}/logo.png`,
      },
      sameAs: [],
    },
    {
      "@type": "SoftwareApplication",
      "@id": `${SITE_URL}/#software`,
      name: "Sophia AI Factory",
      url: SITE_URL,
      description: SITE_DESCRIPTION,
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
        description: "Free tier — 200 MCU credits included",
      },
      publisher: {
        "@id": `${SITE_URL}/#organization`,
      },
    },
  ],
};

export const metadata: Metadata = {
  title: {
    default: SITE_TITLE,
    template: "%s | Sophia AI Factory",
  },
  description: SITE_DESCRIPTION,
  metadataBase: new URL(SITE_URL),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: SITE_URL,
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    siteName: "Sophia AI Factory",
    images: [
      {
        url: OG_IMAGE,
        width: 1200,
        height: 630,
        alt: "Sophia AI Factory — Robot-as-a-Service Platform",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [OG_IMAGE],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0"
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="antialiased">
        <AuthProvider>
          <ToastProvider>{children}</ToastProvider>
        </AuthProvider>
        {process.env.NEXT_PUBLIC_CF_BEACON_TOKEN && (
          <script
            defer
            src="https://static.cloudflareinsights.com/beacon.min.js"
            data-cf-beacon={`{"token":"${process.env.NEXT_PUBLIC_CF_BEACON_TOKEN}"}`}
          />
        )}
      </body>
    </html>
  );
}
