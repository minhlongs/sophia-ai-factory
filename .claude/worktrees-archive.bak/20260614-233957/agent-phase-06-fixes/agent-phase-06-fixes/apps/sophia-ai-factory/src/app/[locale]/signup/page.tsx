import { redirect } from "next/navigation";

/**
 * /[locale]/signup — short alias for signup entry.
 * Server-side redirect to /login?tab=signup, forwarding known query params.
 * Handles /en/signup and /vi/signup (used by marketing CTAs and welcome-tour).
 *
 * NOTE: Redirect target is locale-stripped (/login, not /en/login) to avoid
 * a double-hop through next-intl `as-needed` which can lose query params:
 *   /en/signup → 308 /signup → [this page] → /en/login?tab=signup
 *   → next-intl 308 /login  (query preserved but adds unnecessary hop)
 * Single-hop: /login?tab=signup → intl renders with default locale directly.
 */
export default async function SignupPage({
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
