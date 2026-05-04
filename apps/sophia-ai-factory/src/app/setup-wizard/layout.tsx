import type { Metadata } from "next";
import localFont from "next/font/local";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/seed/auth/better-auth-session";
import { listUserApiKeyProviders } from "@/tree/byok/user-api-key-store";
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { logger } from "@/seed/utils/logger-utility";
import "../globals.css";

const geistSans = localFont({
  src: "../fonts/GeistVF.woff2",
  variable: "--font-geist-sans",
  weight: "100 900",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://sophia.agencyos.network'),
  title: "Setup - Sophia AI Factory",
  description: "Configure your AI Factory settings.",
};

// Layout reads session + D1 + cookies — must render per-request, never prerender.
export const dynamic = "force-dynamic";

export default async function SetupLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getCurrentUser();
  if (!user) {
    const jar = await cookies();
    const cookieNames = jar.getAll().map((c) => c.name);
    logger.warn('[setup-wizard] no authenticated user — redirecting to login', {
      cookieNames,
      hasSessionCookie: cookieNames.some((n) => n.includes('better-auth') || n.includes('session')),
    });
    redirect("/login?redirect=/setup-wizard");
  }

  // Existing users with LLM keys already configured: skip wizard via route handler.
  // Server Components cannot mutate cookies in Next.js 15+, so the cookie set
  // and redirect both happen inside /api/setup/skip (a Route Handler).
  let hasLlmKey = false;
  try {
    const providers = await listUserApiKeyProviders(user.id);
    hasLlmKey = providers.includes("openrouter") || providers.includes("anthropic");
  } catch (err) {
    logger.error('[setup-wizard] listUserApiKeyProviders failed — rendering wizard', err instanceof Error ? err : undefined);
  }
  if (hasLlmKey) {
    redirect("/api/setup/skip");
  }

  // /setup-wizard sits outside the [locale] segment, so next-intl's request
  // middleware never tags the request with a locale. Without an explicit locale
  // here, getMessages() throws notFound() and Next renders a 404. Read the
  // user's preferred locale from the cookie set by /vi or /en routes (or
  // default to 'vi' for our predominantly-Vietnamese customer base).
  const jar = await cookies();
  const locale = jar.get("NEXT_LOCALE")?.value === "en" ? "en" : "vi";
  const messages = await getMessages({ locale });

  return (
    <html lang={locale}>
      <body className={`${geistSans.variable} antialiased`}>
        <NextIntlClientProvider messages={messages} locale={locale}>
          <div className="min-h-screen bg-muted/50">
            {/* No Navbar here - specialized layout for setup */}
            {children}
          </div>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
