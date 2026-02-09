import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "../globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Setup - Sophia AI Factory",
  description: "Configure your AI Factory settings.",
};

export default function SetupLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} antialiased`}>
        <div className="min-h-screen bg-muted/50">
          {/* No Navbar here - specialized layout for setup */}
          {children}
        </div>
      </body>
    </html>
  );
}
