import { redirect } from "@/navigation";
import { LandingHero } from "@/components/stitch/screens/landing-hero";
import { buildCorePagePayload } from "@/seed/aeo";
import { normalizeAeoLocale } from "@/tree/aeo";
import { DualReadPageSection } from "@/forest/components/aeo";
import { buildHomeMetadata } from "./home-metadata";

// Marketing homepage — edge cache 60s
export const revalidate = 60;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return buildHomeMetadata(locale);
}

export default async function Home({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  const sp = await searchParams;

  if (typeof sp.tab === "string" && sp.tab === "signup") {
    const query = new URLSearchParams({ tab: "signup" });
    if (typeof sp.coupon === "string") query.set("coupon", sp.coupon);
    if (typeof sp.tier === "string") query.set("tier", sp.tier);
    if (typeof sp.redirect === "string") query.set("redirect", sp.redirect);
    redirect({ href: `/login?${query.toString()}`, locale });
  }

  const aeoPayload = buildCorePagePayload('home', normalizeAeoLocale(locale));

  return (
    <>
      <LandingHero />
      <DualReadPageSection payload={aeoPayload} />
    </>
  );
}
