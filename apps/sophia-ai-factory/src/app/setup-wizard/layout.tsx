import type { Metadata } from "next";
import localFont from "next/font/local";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/better-auth-session";
import { listUserApiKeyProviders } from "@/lib/byok/user-api-key-store";
import "../globals.css";

const geistSans = localFont({
  src: "../fonts/GeistVF.woff2",
  variable: "--font-geist-sans",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "Setup - Sophia AI Factory",
  description: "Configure your AI Factory settings.",
};

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
  // Prevents UX regression where pre-existing users (no wizard_done cookie) get forced through wizard.
  const providers = await listUserApiKeyProviders(user.id);
  const hasLlmKey = providers.includes("openrouter") || providers.includes("anthropic");
  if (hasLlmKey) {
    const jar = await cookies();
    jar.set("wizard_done", "1", {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
    redirect("/dashboard");
  }

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
