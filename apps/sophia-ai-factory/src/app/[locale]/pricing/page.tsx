import type { ComponentType } from "react";
import { getTranslations } from "next-intl/server";
import { isHeyGenHealthy } from "@/seed/health/heygen-health-check";
import type { Tier } from "@/seed/types";
import Link from "next/link";
import { buildAllProductSchemas, buildBreadcrumbSchema, BREADCRUMBS } from "@/land/seo/schema-org";

// Pricing page — cache 1 hour at the edge.
export const revalidate = 3600;

export const metadata = {
  title: "Pricing — Sophia AI Factory | Plans from $199",
  description: "Video Factory + AI Automation — One Platform. Plans from $199/month to $4,999 lifetime. USDT/crypto payments accepted.",
};

export default async function PricingPage() {
  let t: (key: string) => string = (key) => key;
  let heygenHealthy = false;
  let user: unknown = null;
  let userHeyGenConfigured = false;
  let currentTier: Tier | null = null;
  let productSchemas: object[] = [];
  let breadcrumbSchema: unknown = null;

  type ImportedPricingModules = {
    PricingSection?: ComponentType<Record<string, never>>;
    PricingComparisonTable?: ComponentType<{ currentTier: Tier | null }>;
    PricingFaq?: ComponentType<Record<string, never>>;
    ProductionCostCalculator?: ComponentType<Record<string, never>>;
    OneTimeBundleCard?: ComponentType<{ heygenHealthy: boolean }>;
    CryptoPaymentExplainer?: ComponentType<Record<string, never>>;
  };

  // Components (initially absent until dynamic imports resolve)
  let PricingSectionComponent: ComponentType<Record<string, never>> | null = null;
  let PricingComparisonTableComponent: ComponentType<{ currentTier: Tier | null }> | null = null;
  let PricingFaqComponent: ComponentType<Record<string, never>> | null = null;
  let ProductionCostCalculatorComponent: ComponentType<Record<string, never>> | null = null;
  let OneTimeBundleCardComponent: ComponentType<{ heygenHealthy: boolean }> | null = null;
  let CryptoPaymentExplainerComponent: ComponentType<Record<string, never>> | null = null;

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
    } catch {
      // Auth subsystem unavailable — page continues without user-specific UI
      // console.warn('[pricing] auth modules unavailable:', err);
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
      pricingSection,
      pricingComparisonTable,
      pricingFaq,
      productionCostCalc,
      oneTimeBundle,
      cryptoExplainer,
    ] = await Promise.allSettled<ImportedPricingModules>([
      import("@/forest/components/pricing/pricing-section").then(m => ({ PricingSection: m.PricingSection })),
      import("@/forest/components/pricing/pricing-comparison-table").then(m => ({ PricingComparisonTable: m.PricingComparisonTable })),
      import("@/forest/components/pricing/pricing-faq").then(m => ({ PricingFaq: m.PricingFaq })),
      import("@/app/components/sections/production-cost-calculator").then(m => ({ ProductionCostCalculator: m.ProductionCostCalculator })),
      import("@/forest/components/pricing/one-time-bundle-card").then(m => ({ OneTimeBundleCard: m.OneTimeBundleCard })),
      import("@/forest/components/checkout/crypto-payment-explainer").then(m => ({ CryptoPaymentExplainer: m.CryptoPaymentExplainer })),
    ]);

    if (pricingSection.status === 'fulfilled' && pricingSection.value.PricingSection) {
      PricingSectionComponent = pricingSection.value.PricingSection;
    }
    if (pricingComparisonTable.status === 'fulfilled' && pricingComparisonTable.value.PricingComparisonTable) {
      PricingComparisonTableComponent = pricingComparisonTable.value.PricingComparisonTable;
    }
    if (pricingFaq.status === 'fulfilled' && pricingFaq.value.PricingFaq) {
      PricingFaqComponent = pricingFaq.value.PricingFaq;
    }
    if (productionCostCalc.status === 'fulfilled' && productionCostCalc.value.ProductionCostCalculator) {
      ProductionCostCalculatorComponent = productionCostCalc.value.ProductionCostCalculator;
    }
    if (oneTimeBundle.status === 'fulfilled' && oneTimeBundle.value.OneTimeBundleCard) {
      OneTimeBundleCardComponent = oneTimeBundle.value.OneTimeBundleCard;
    }
    if (cryptoExplainer.status === 'fulfilled' && cryptoExplainer.value.CryptoPaymentExplainer) {
      CryptoPaymentExplainerComponent = cryptoExplainer.value.CryptoPaymentExplainer;
    }

  } catch {
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
    <main id="main-content" className="min-h-screen bg-gradient-to-b from-background to-card pt-16">
      {/* Structured data */}
      {productSchemas.map((schema, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) ?? '' }} />
      ))}
      {breadcrumbSchema ? (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      ) : null}

      {/* Header */}
      <div className="border-b border-border bg-gradient-to-r from-violet-900/30 to-blue-900/30 px-6 py-8 text-center">
        <div className="mx-auto max-w-3xl">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-accent">
            {t("combined_badge")}
          </div>
          {currentTier && (
            <div className="mb-3">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-300">
                {t("current_plan_badge")}: {currentTier}
              </span>
            </div>
          )}
          <h1 className="text-2xl font-bold text-foreground sm:text-3xl">{t("combined_title")}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{t("combined_subtitle")}</p>
          {user != null && (
            <div className="mt-4">
              <Link href="/dashboard" className="cursor-pointer text-xs text-accent hover:text-accent transition-colors duration-150">
                &larr; {t("nav_dashboard")}
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Components */}
      {PricingSectionComponent ? <PricingSectionComponent /> : null}
      {CryptoPaymentExplainerComponent ? (
        <div className="mx-auto max-w-2xl px-6 pb-6"><CryptoPaymentExplainerComponent /></div>
      ) : null}
      <section className="mx-auto max-w-md px-6 pb-12 pt-4">
        {user != null && !userHeyGenConfigured ? (
          <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-6 text-center space-y-3">
            <p className="text-sm font-medium text-amber-300">
              Configure your HeyGen API key to unlock video generation bundles.
              <br />
              <span className="text-amber-400/80">Vui lòng cấu hình HeyGen API key để mở khóa gói video.</span>
            </p>
            <Link href="/dashboard/onboarding" className="cursor-pointer inline-block rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-semibold px-5 py-2 text-sm transition-colors duration-150">
              Configure HeyGen Key / Cấu hình HeyGen
            </Link>
          </div>
        ) : OneTimeBundleCardComponent ? (
          <OneTimeBundleCardComponent heygenHealthy={heygenHealthy} />
        ) : null}
      </section>
      {PricingComparisonTableComponent ? <PricingComparisonTableComponent currentTier={currentTier} /> : null}
      {ProductionCostCalculatorComponent ? <ProductionCostCalculatorComponent /> : null}
      {PricingFaqComponent ? <PricingFaqComponent /> : null}
    </main>
  );
}
