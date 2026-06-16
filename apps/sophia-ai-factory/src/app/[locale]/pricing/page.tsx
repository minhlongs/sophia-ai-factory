import { PricingSection } from "@/forest/components/pricing/pricing-section";
import { PricingComparisonTable } from "@/forest/components/pricing/pricing-comparison-table";
import { PricingFaq } from "@/forest/components/pricing/pricing-faq";
import { ProductionCostCalculator } from "@/app/components/sections/production-cost-calculator";
import { OneTimeBundleCard } from "@/forest/components/pricing/one-time-bundle-card";
import { CryptoPaymentExplainer } from "@/forest/components/checkout/crypto-payment-explainer";
import { getTranslations } from "next-intl/server";
import { isHeyGenHealthy } from "@/seed/health/heygen-health-check";
import { getCurrentUser } from "@/seed/auth/better-auth-session";
import { getUserCredential } from "@/tree/credentials/user-credentials-repo";
import { resolveUserTier } from "@/seed/db/resolve-user-tier";
import type { Tier } from "@/seed/types";
import Link from "next/link";
import { buildAllProductSchemas, buildBreadcrumbSchema, BREADCRUMBS } from "@/land/seo/schema-org";
import { logger } from "@/seed/utils/logger-utility";

// Pricing page — cache 1 hour at the edge. PricingSection reads HeyGen health
// per request; we accept it may be 1h stale at peak. Calculator + FAQ are
// pure-static and benefit most from caching.
export const revalidate = 3600;

export const metadata = {
  title: "Pricing — Sophia AI Factory | Plans from $199",
  description: "Video Factory + AI Automation — One Platform. Plans from $199/month to $4,999 lifetime. USDT/crypto payments accepted.",
};

export default async function PricingPage() {
  let t: (key: string) => string = (key) => key;
  let heygenHealthy = false;
  let user: Awaited<ReturnType<typeof getCurrentUser>> = null;
  let userHeyGenConfigured = false;
  let currentTier: Tier | null = null;
  let productSchemas: Array<Record<string, unknown>> = [];
  let breadcrumbSchema: Record<string, unknown> | null = null;
  let error: Error | null = null;

  try {
    [t, heygenHealthy, user] = await Promise.all([
      getTranslations("pricing"),
      isHeyGenHealthy().catch(() => false),
      getCurrentUser().catch(() => null),
    ]);

    // Check if the logged-in user has configured their HeyGen key
    userHeyGenConfigured = user
      ? Boolean(await getUserCredential(user.id, 'heygen').catch((e) => {
          logger.warn('[PricingPage] getUserCredential failed', e);
          return null;
        }))
      : false;

    const resolvedTier = user ? await resolveUserTier(user.id).catch((e) => {
      logger.warn('[PricingPage] resolveUserTier failed', e);
      return null;
    }) : null;
    if (resolvedTier) currentTier = resolvedTier as Tier;

    // Build schemas with individual error isolation
    try {
      productSchemas = buildAllProductSchemas();
      logger.info('[PricingPage] buildAllProductSchemas success', { count: productSchemas.length });
    } catch (e) {
      logger.error('[PricingPage] buildAllProductSchemas FAILED', e as Error);
      productSchemas = [];
    }

    try {
      breadcrumbSchema = buildBreadcrumbSchema(BREADCRUMBS.pricing) as Record<string, unknown>;
      logger.info('[PricingPage] buildBreadcrumbSchema success');
    } catch (e) {
      logger.error('[PricingPage] buildBreadcrumbSchema FAILED', e as Error);
      // Last resort fallback
      try {
        breadcrumbSchema = buildBreadcrumbSchema([
          { name: 'Home', url: 'https://sophia.agencyos.network' },
          { name: 'Pricing', url: 'https://sophia.agencyos.network/pricing' },
        ]) as Record<string, unknown>;
      } catch {
        breadcrumbSchema = null;
      }
    }
  } catch (err) {
    error = err instanceof Error ? err : new Error(String(err));
    logger.error('[PricingPage] Failed to load data', error, {
      hasUser: !!user,
      hasTier: !!currentTier,
      productSchemasBuilt: productSchemas.length,
      breadcrumbBuilt: !!breadcrumbSchema,
    });
    // Fallback values to still render something
    t = (key: string) => key;
    heygenHealthy = false;
    userHeyGenConfigured = false;
    currentTier = null;
    productSchemas = [];
    try {
      breadcrumbSchema = buildBreadcrumbSchema(BREADCRUMBS.pricing) as Record<string, unknown>;
    } catch {
      breadcrumbSchema = null;
    }
  }

  return (
    <main id="main-content" className="min-h-screen bg-gradient-to-b from-background to-card pt-16">
      {/* Structured data — 4x Product schemas + BreadcrumbList */}
      {productSchemas && productSchemas.map((schema, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
      ))}
      {breadcrumbSchema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
        />
      )}
      {/* Combined value messaging header */}
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
          {error && (
            <div className="mb-3 p-3 bg-yellow-900/20 border border-yellow-500/30 rounded text-yellow-200 text-xs">
              ⚠️ Some pricing data may be temporarily unavailable. Please try again in a few minutes.
            </div>
          )}
          <h1 className="text-2xl font-bold text-foreground sm:text-3xl">
            {t("combined_title")}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {t("combined_subtitle")}
          </p>
          {user && (
            <div className="mt-4">
              <Link
                href="/dashboard"
                className="cursor-pointer text-xs text-accent hover:text-accent transition-colors duration-150"
              >
                &larr; {t("nav_dashboard")}
              </Link>
            </div>
          )}
        </div>
      </div>

      <PricingSection />

      {/* Crypto explainer — plain-language USDT guide for non-crypto Vietnamese users */}
      <div className="mx-auto max-w-2xl px-6 pb-6">
        <CryptoPaymentExplainer />
      </div>

      {/* One-Time Bundle — pay once, no monthly commitment */}
      <section className="mx-auto max-w-md px-6 pb-12 pt-4">
        {user && !userHeyGenConfigured ? (
          /* Gate: user must configure HeyGen key before purchasing */
          <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-6 text-center space-y-3">
            <p className="text-sm font-medium text-amber-300">
              Configure your HeyGen API key to unlock video generation bundles.
              <br />
              <span className="text-amber-400/80">
                Vui lòng cấu hình HeyGen API key để mở khóa gói video.
              </span>
            </p>
            <Link
              href="/dashboard/onboarding"
              className="cursor-pointer inline-block rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-semibold px-5 py-2 text-sm transition-colors duration-150"
            >
              Configure HeyGen Key / Cấu hình HeyGen
            </Link>
          </div>
        ) : (
          <OneTimeBundleCard heygenHealthy={heygenHealthy} />
        )}
      </section>

      {/* Comparison table */}
      <PricingComparisonTable currentTier={currentTier} />

      <ProductionCostCalculator />

      {/* FAQ + Talk to Sales */}
      <PricingFaq />
    </main>
  );
}
