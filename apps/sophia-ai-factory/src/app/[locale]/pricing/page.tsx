import { getTranslations } from "next-intl/server";
import { useTranslations } from "next-intl";
import { isHeyGenHealthy } from "@/seed/health/heygen-health-check";
import type { Tier } from "@/seed/types";
import Link from "next/link";
import { buildAllProductSchemas, buildBreadcrumbSchema, BREADCRUMBS } from "@/land/seo/schema-org";

// Pricing page — dynamic render with 1 hour edge cache.
export const dynamic = 'force-dynamic';
export const revalidate = 3600;

export const metadata = {
  title: "Pricing — Sophia AI Factory | Plans from $199",
  description: "Video Factory + AI Automation — One Platform. Plans from $199/month to $4,999 lifetime. USDT/crypto payments accepted.",
};

// Fallback component that renders nothing but matches React.ComponentType signature
const EmptyComponent = (() => null) as React.ComponentType<Record<string, unknown>>;

export default async function PricingPage() {
  let t: (key: string) => string = (key) => key;
  let heygenHealthy = false;
  let user: unknown = null;
  let userHeyGenConfigured = false;
  let currentTier: Tier | null = null;
  let productSchemas: object[] = [];
  let breadcrumbSchema: unknown = null;

  // Components (initially set to fallback)
  let PricingStitchSectionComponent: React.ComponentType<{ isAuthenticated?: boolean; currentTier?: string | null }> = EmptyComponent as React.ComponentType<{ isAuthenticated?: boolean; currentTier?: string | null }>;
  let PricingFaqComponent: React.ComponentType<object> = EmptyComponent as React.ComponentType<object>;

  try {
    [t, heygenHealthy] = await Promise.all([
      getTranslations("pricing"),
      isHeyGenHealthy().catch(() => false),
    ]);

    // Auth and tier lookup are loaded dynamically to isolate module factory errors
    user = null;
    userHeyGenConfigured = false;
    currentTier = null;

    try {
      const { getCurrentUser } = await import("@/seed/auth/better-auth-session");
      const { getUserCredential } = await import("@/tree/credentials/user-credentials-repo");
      const { resolveUserTier } = await import("@/seed/db/resolve-user-tier");

      const fetchedUser = await getCurrentUser().catch(() => null);
      user = fetchedUser;

      if (fetchedUser) {
        const hasCredential = await getUserCredential(fetchedUser.id, 'heygen').catch(() => null);
        userHeyGenConfigured = Boolean(hasCredential);
        const resolvedTier = await resolveUserTier(fetchedUser.id).catch(() => null);
        if (resolvedTier) currentTier = resolvedTier as Tier;
      }
    } catch (authErr) {
      // Auth subsystem unavailable — page continues without user-specific UI
    }

    try {
      productSchemas = buildAllProductSchemas();
    } catch {
      productSchemas = [];
    }

    try {
      breadcrumbSchema = buildBreadcrumbSchema(BREADCRUMBS.pricing);
    } catch {
      try {
        breadcrumbSchema = buildBreadcrumbSchema([
          { name: 'Home', url: 'https://sophia.agencyos.network' },
          { name: 'Pricing', url: 'https://sophia.agencyos.network/pricing' },
        ]);
      } catch {
        breadcrumbSchema = null;
      }
    }

    // Dynamic imports — each independent, failures isolated
    const [
      pricingStitchSection,
      pricingFaq,
    ] = await Promise.allSettled<React.ComponentType<object> | null>([
      import("@/forest/components/pricing/pricing-stitch-section").then(m => m.PricingStitchSection ?? null),
      import("@/forest/components/pricing/pricing-faq").then(m => m.PricingFaq ?? null),
    ]);

    if (pricingStitchSection.status === 'fulfilled' && pricingStitchSection.value) {
      PricingStitchSectionComponent = pricingStitchSection.value as React.ComponentType<{ isAuthenticated?: boolean; currentTier?: string | null }>;
    }
    if (pricingFaq.status === 'fulfilled' && pricingFaq.value) {
      PricingFaqComponent = pricingFaq.value as React.ComponentType<object>;
    }

  } catch (err) {
    // All components already default to EmptyComponent; other data gets defaults inline
    t = (key: string) => key;
    heygenHealthy = false;
    userHeyGenConfigured = false;
    currentTier = null;
    productSchemas = [];
    try {
      breadcrumbSchema = buildBreadcrumbSchema(BREADCRUMBS.pricing);
    } catch {
      breadcrumbSchema = null;
    }
  }

  return (
    <main id="main-content" className="min-h-screen bg-[#0F0F11]">
      {/* Structured data */}
      {productSchemas.map((schema, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) ?? '' }} />
      ))}
      {breadcrumbSchema ? (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      ) : null}

      {/* Stitch-designed pricing section */}
      <PricingStitchSectionComponent isAuthenticated={!!user} currentTier={currentTier} />

      {/* Heygen configure prompt for authenticated users without a heygen key */}
      {user != null && !userHeyGenConfigured ? (
        <section className="mx-auto max-w-md px-6 pb-12">
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-6 text-center space-y-3">
            <p className="text-sm font-medium text-amber-400">
              {t("heygen_configure_prompt")}
            </p>
            <Link href="/dashboard/onboarding" className="inline-block rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-semibold px-5 py-2 text-sm transition-colors duration-150">
              {t("heygen_configure_cta")}
            </Link>
          </div>
        </section>
      ) : null}

      {/* FAQ accordion */}
      <PricingFaqComponent />
    </main>
  );
}
