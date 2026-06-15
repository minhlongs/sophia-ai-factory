import type { Metadata } from "next";
import localFont from "next/font/local";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/seed/auth/better-auth-session";
import { listUserApiKeyProviders } from "@/tree/byok/user-api-key-store";
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { logger } from "@/seed/utils/logger-utility";
import "../../globals.css";

const geistSans = localFont({
  src: "../../fonts/GeistVF.woff2",
  variable: "--font-geist-sans",
  weight: "100 900",
  display: "swap",
});

const geistMono = localFont({
  src: "../../fonts/GeistMonoVF.woff2",
  variable: "--font-geist-mono",
  weight: "100 900",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Sophia - Setup Wizard",
  description: "Complete your API key configuration",
};

export default async function SetupWizardLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const cookieStore = await cookies();
  const sessionId = cookieStore.get("better-auth.session_token")?.value;

  if (!sessionId) {
    redirect(`/${locale}/login`);
  }

  try {
    const user = await getCurrentUser();
    if (!user) {
      redirect(`/${locale}/login`);
    }

    const apiKeyProviders = await listUserApiKeyProviders(user.id);
    logger.info("Setup wizard: providers count", { count: apiKeyProviders.length });
  } catch (error) {
    logger.error("Setup wizard: auth check failed", { error });
    redirect(`/${locale}/login`);
  }

  const messages = await getMessages();

  return (
    <html lang={locale}>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <NextIntlClientProvider messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
