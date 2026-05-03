import type { Metadata } from "next";
import localFont from "next/font/local";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/better-auth-session";
import { listUserApiKeyProviders } from "@/lib/byok/user-api-key-store";
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
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
    redirect("/login?redirect=/setup-wizard");
  }

  // Existing users with LLM keys already configured: skip wizard, set cookie, send to dashboard.
  const providers = await listUserApiKeyProviders(user.id);
  const hasLlmKey = providers.includes("openrouter") || providers.includes("anthropic");
  if (hasLlmKey) {
    const jar = await cookies();
    // Per-user cookie name keeps wizard state scoped to the current user so
    // multiple users on the same browser don't bypass each other's onboarding.
    jar.set(`wizard_done_${user.id.slice(0, 12)}`, "1", {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
    redirect("/dashboard");
  }

  const messages = await getMessages();

  return (
    <html lang="en">
      <body className={`${geistSans.variable} antialiased`}>
        <NextIntlClientProvider messages={messages} locale="en">
          <div className="min-h-screen bg-muted/50">
            {/* No Navbar here - specialized layout for setup */}
            {children}
          </div>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
