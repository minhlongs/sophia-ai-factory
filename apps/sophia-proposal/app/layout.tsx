import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/auth/auth-provider";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

const SITE_URL = "https://sophia.agencyos.network";

export const metadata: Metadata = {
  title: {
    default: "Sophia AI Factory",
    template: "%s | Sophia AI Factory",
  },
  description:
    "Build, deploy, and scale AI-powered applications with confidence using Sophia AI Factory",
  metadataBase: new URL(SITE_URL),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: SITE_URL,
    title: "Sophia AI Factory",
    description:
      "Build, deploy, and scale AI-powered applications with confidence",
    siteName: "Sophia AI Factory",
    images: [
      {
        url: `${SITE_URL}/og-image.png`,
        width: 1200,
        height: 630,
        alt: "Sophia AI Factory",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Sophia AI Factory",
    description:
      "Build, deploy, and scale AI-powered applications with confidence",
    images: [`${SITE_URL}/og-image.png`],
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
  other: {
    "link:stylesheet":
      "https://fonts.googleapis.com/icon?family=Material+Icons",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="antialiased">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
