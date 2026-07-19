import type { Metadata } from "next";
import { Playfair_Display, Inter } from "next/font/google";
import { CartProvider } from "@/lib/cart-context";
import { CartDrawer } from "@/components/cart/cart-drawer";
import "./globals.css";

const playfair = Playfair_Display({
  variable: "--font-display",
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700"],
});

const inter = Inter({
  variable: "--font-body",
  subsets: ["latin", "vietnamese"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "84tea | Trà Năng Lượng Việt - Trà Cổ Thụ Lên Men",
  description:
    "84tea - Thương hiệu trà cao cấp Việt Nam. Bộ sưu tập 84 Limited: trà lên men từ cây Shan Tuyết cổ thụ. Nơi truyền thống gặp gỡ sang trọng.",
  keywords: [
    "84tea",
    "trà Việt Nam",
    "trà lên men",
    "Shan Tuyết",
    "trà cao cấp",
    "trà cổ thụ",
    "84 Limited",
    "Trà Năng Lượng Việt",
    "trà Hà Giang",
  ],
  authors: [{ name: "84tea" }],
  openGraph: {
    title: "84tea | Trà Năng Lượng Việt",
    description:
      "Thương hiệu trà cao cấp Việt Nam với bộ sưu tập 84 Limited - trà lên men từ cây Shan Tuyết cổ thụ.",
    url: "https://84tea.com",
    siteName: "84tea",
    locale: "vi_VN",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "84tea | Trà Năng Lượng Việt",
    description: "Thương hiệu trà cao cấp Việt Nam với bộ sưu tập 84 Limited.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <head>
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap"
        />
      </head>
      <body
        className={`${playfair.variable} ${inter.variable} antialiased bg-surface text-on-surface`}
      >
        <CartProvider>
          {children}
          <CartDrawer />
        </CartProvider>
      </body>
    </html>
  );
}
