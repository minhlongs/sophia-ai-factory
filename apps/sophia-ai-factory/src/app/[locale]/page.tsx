import { redirect } from "@/navigation";
import { LandingHero } from "@/components/stitch/screens/landing-hero";
import { buildCorePagePayload } from "@/seed/aeo";
import { normalizeAeoLocale } from "@/tree/aeo";
import { DualReadPageSection } from "@/forest/components/aeo";
import { buildSignupEntryHref } from "@/tree/affiliate/onboarding/entry-params";
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
    // Preserve offerId / locale / returnTo / selected tier through the real
    // login route instead of dropping them or forwarding arbitrary params.
    redirect({ href: buildSignupEntryHref(sp), locale });
  }

  const aeoPayload = buildCorePagePayload('home', normalizeAeoLocale(locale));

  return (
    <LandingHero
      beforeFooterSlot={<DualReadPageSection payload={aeoPayload} />}
    />
  );
}
