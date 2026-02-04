import type { Metadata } from "next";
import { Inter, Orbitron } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const orbitron = Orbitron({
  variable: "--font-orbitron",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "AI Video Factory - Nền Tảng Video AI + Affiliate Marketing",
  description: "Tự động sản xuất video, phân phối đa kênh, thu nhập thụ động với OpenClaw + n8n + AI Tools",
  keywords: ["AI Video", "Affiliate Marketing", "OpenClaw", "n8n", "Automation", "Passive Income"],
  authors: [{ name: "AgencyOS" }],
  openGraph: {
    title: "AI Video Factory - Nền Tảng Video AI + Affiliate Marketing",
    description: "Tự động sản xuất video, phân phối đa kênh, thu nhập thụ động",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <body
        className={`${inter.variable} ${orbitron.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
