import { getTranslations } from "next-intl/server";
import { redirect } from "@/navigation";

// Marketing homepage — cache at the edge for 60s with stale-while-revalidate.
// Translates to `Cache-Control: s-maxage=60, stale-while-revalidate=...` in Next 16.
export const revalidate = 60;

import { LandingHero } from "@/components/stitch/screens/landing-hero";
import { buildFAQPageSchema, buildOrganizationSchema } from "@/land/seo/schema-org";
import { buildHomeMetadata } from "./home-metadata";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return buildHomeMetadata(locale);
}

const FAQ_KEYS = ['quality', 'copyright', 'time', 'skills', 'support', 'money', 'tiers', 'refund'] as const;

export default async function Home({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  const sp = await searchParams;

  // Redirect /?tab=signup → /login?tab=signup so marketing links and
  // bookmarks that land on the homepage with the signup intent parameter
  // reach the register form instead of silently showing the homepage.
  // Uses locale-aware redirect from @/navigation to avoid double redirect
  // through middleware (standard next/navigation redirect loses locale prefix).
  if (typeof sp.tab === "string" && sp.tab === "signup") {
    const query = new URLSearchParams({ tab: "signup" });
    if (typeof sp.coupon === "string") query.set("coupon", sp.coupon);
    if (typeof sp.tier === "string") query.set("tier", sp.tier);
    if (typeof sp.redirect === "string") query.set("redirect", sp.redirect);
    redirect({ href: `/login?${query.toString()}`, locale });
  }

  const t = await getTranslations('landing');
  const faqSchema = buildFAQPageSchema(
    FAQ_KEYS.map(key => ({
      q: t(`faq.items.${key}.question`),
      a: t(`faq.items.${key}.answer`),
    }))
  );
  const orgSchema = buildOrganizationSchema();

  return (
    <>
      {/* Organization structured data — global brand signal */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(orgSchema) }}
      />
      {/* FAQPage structured data — matches landing FAQ section */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <LandingHero />
    </>
  );
}
