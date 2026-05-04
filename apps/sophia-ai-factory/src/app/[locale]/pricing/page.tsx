import { PricingSection } from "@/forest/components/pricing/pricing-section";
import { PricingComparisonTable } from "@/forest/components/pricing/pricing-comparison-table";
import { PricingFaq } from "@/forest/components/pricing/pricing-faq";
import { ProductionCostCalculator } from "@/app/components/sections/production-cost-calculator";
import { OneTimeBundleCard } from "@/forest/components/pricing/one-time-bundle-card";
import { getTranslations } from "next-intl/server";
import { isHeyGenHealthy } from "@/seed/health/heygen-health-check";
import { getCurrentUser } from "@/seed/auth/better-auth-session";
import { getUserCredential } from "@/tree/credentials/user-credentials-repo";
import { getUserTier } from "@/seed/db/get-user-tier";
import Link from "next/link";
import { buildAllProductSchemas, buildBreadcrumbSchema, BREADCRUMBS } from "@/lib/seo/schema-org";

export const metadata = {
  title: "Pricing - Sophia AI Factory",
  description: "Video Factory + AI Automation — One Platform",
};

export default async function PricingPage() {
  const [t, heygenHealthy, user] = await Promise.all([
    getTranslations("pricing"),
    isHeyGenHealthy().catch(() => false),
    getCurrentUser().catch(() => null),
  ]);

  // Check if the logged-in user has configured their HeyGen key
  const userHeyGenConfigured = user
    ? Boolean(await getUserCredential(user.id, 'heygen').catch(() => null))
    : false;

  const currentTier = user ? await getUserTier(user.id).catch(() => null) : null;

  const productSchemas = buildAllProductSchemas();
  const breadcrumbSchema = buildBreadcrumbSchema(BREADCRUMBS.pricing);

  return (
    <main id="main-content" className="min-h-screen bg-gradient-to-b from-black to-violet-950 pt-16">
      {/* Structured data — 4x Product schemas + BreadcrumbList */}
      {productSchemas.map((schema, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
      ))}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      {/* Combined value messaging header */}
      <div className="border-b border-white/5 bg-gradient-to-r from-violet-900/30 to-blue-900/30 px-6 py-8 text-center">
        <div className="mx-auto max-w-3xl">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1 text-xs font-medium text-violet-300">
            {t("combined_badge")}
          </div>
          {currentTier && (
            <div className="mb-3">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-green-500/30 bg-green-500/10 px-3 py-1 text-xs font-medium text-green-300">
                {t("current_plan_badge")}: {currentTier}
              </span>
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
                className="cursor-pointer text-xs text-violet-300 hover:text-violet-200 transition-colors duration-150"
              >
                &larr; {t("nav_dashboard")}
              </Link>
            </div>
          )}
        </div>
      </div>

      <PricingSection />

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
              href="/setup-wizard"
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
