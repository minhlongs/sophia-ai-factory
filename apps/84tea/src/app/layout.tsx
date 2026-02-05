import type { Metadata, Viewport } from "next";
import { ThemeProvider } from "next-themes";
import { playfairDisplay, inter } from "@/lib/fonts";
import { CartProvider } from "@/lib/cart-context";
import { CartDrawer } from "@/components/cart/cart-drawer";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

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
  verification: {
    google: "",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <head>
        {/* Material Symbols - Optimized loading */}
        <link
          rel="preconnect"
          href="https://fonts.googleapis.com"
        />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap"
        />
      </head>
      <body
        className={`${playfairDisplay.variable} ${inter.variable} antialiased bg-surface text-on-surface`}
      >
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <CartProvider>
            {children}
            <CartDrawer />
          </CartProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
