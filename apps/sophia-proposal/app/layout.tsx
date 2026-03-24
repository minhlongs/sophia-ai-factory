import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/auth/auth-provider";
import { ToastProvider } from "@/components/ui/toast-provider";

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
  },
  twitter: {
    card: "summary",
    title: "Sophia AI Factory",
    description:
      "Build, deploy, and scale AI-powered applications with confidence",
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
    <html lang="en" className={inter.variable}>
      <head>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0"
        />
      </head>
      <body className="antialiased">
        <AuthProvider>
          <ToastProvider>{children}</ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
