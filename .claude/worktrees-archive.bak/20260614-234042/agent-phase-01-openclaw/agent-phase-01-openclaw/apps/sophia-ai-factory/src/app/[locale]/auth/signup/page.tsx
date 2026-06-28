import { redirect } from "next/navigation";

/**
 * /[locale]/auth/signup — canonical signup entry point.
 * Server-side redirect to /login?tab=signup, forwarding known query params.
 * Handles /en/auth/signup, /vi/auth/signup (and default locale without prefix).
 *
 * NOTE: Redirect target is locale-stripped (/login, not /en/login) to avoid
 * a double-hop through next-intl `as-needed` which can lose query params.
 * See /[locale]/signup/page.tsx for details.
 */
export default async function AuthSignupPage({
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;

  const query = new URLSearchParams({ tab: "signup" });
  if (typeof sp.coupon === "string") query.set("coupon", sp.coupon);
  if (typeof sp.tier === "string") query.set("tier", sp.tier);
  if (typeof sp.redirect === "string") query.set("redirect", sp.redirect);

  redirect(`/login?${query.toString()}`);
}
