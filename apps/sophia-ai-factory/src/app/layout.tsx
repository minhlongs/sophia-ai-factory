import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Navbar } from "./components/layout/navbar";
import { QueryProvider } from "@/components/providers/query-provider";

import { ThemeProvider } from "@/components/providers/theme-provider";
import { Toaster } from "sonner";
import { MockModeIndicator } from "@/components/dev/mock-mode-indicator";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
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
  authors: [{ name: "Sophia AI Factory" }],
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
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <QueryProvider>
            <Navbar />
            {children}
            <MockModeIndicator />
            <Toaster />
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
