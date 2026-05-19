import { redirect } from "next/navigation";

/**
 * /[locale]/signup — short alias for signup entry.
 * Server-side redirect to /login?tab=signup, forwarding known query params.
 * Handles /en/signup and /vi/signup (used by marketing CTAs and welcome-tour).
 */
export default async function SignupPage({
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
