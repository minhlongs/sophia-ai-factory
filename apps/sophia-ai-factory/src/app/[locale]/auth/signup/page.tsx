import { redirect } from "next/navigation";

/**
 * /[locale]/auth/signup — canonical signup entry point.
 * Server-side redirect to /login?tab=signup, forwarding known query params.
 * Handles /en/auth/signup, /vi/auth/signup (and default locale without prefix).
 */
export default async function AuthSignupPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  const sp = await searchParams;

  const query = new URLSearchParams({ tab: "signup" });
  if (typeof sp.coupon === "string") query.set("coupon", sp.coupon);
  if (typeof sp.tier === "string") query.set("tier", sp.tier);
  if (typeof sp.redirect === "string") query.set("redirect", sp.redirect);

  redirect(`/${locale}/login?${query.toString()}`);
}
