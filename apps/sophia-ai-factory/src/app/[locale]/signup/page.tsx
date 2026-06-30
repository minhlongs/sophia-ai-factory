import { redirect } from "@/navigation";

/**
 * /[locale]/signup — short alias for signup entry.
 * Server-side redirect to /login?tab=signup, forwarding known query params.
 * Uses locale-aware redirect from @/navigation to avoid double-hop.
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

  redirect({ href: `/login?${query.toString()}`, locale });
}
