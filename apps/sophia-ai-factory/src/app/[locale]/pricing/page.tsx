import { PricingSection } from "@/components/pricing/pricing-section";
import { ProductionCostCalculator } from "@/app/components/sections/production-cost-calculator";
import { OneTimeBundleCard } from "@/components/pricing/one-time-bundle-card";
import { getTranslations } from "next-intl/server";
import { isHeyGenHealthy } from "@/lib/health/heygen-health-check";

export const metadata = {
  title: "Pricing - Sophia AI Factory",
  description: "Video Factory + AI Automation — One Platform",
};

export default async function PricingPage() {
  const [t, heygenHealthy] = await Promise.all([
    getTranslations("pricing"),
    isHeyGenHealthy().catch(() => false),
  ]);

  return (
    <main id="main-content" className="min-h-screen bg-gradient-to-b from-black to-violet-950 pt-16">
      {/* Combined value messaging header */}
      <div className="border-b border-white/5 bg-gradient-to-r from-violet-900/30 to-blue-900/30 px-6 py-8 text-center">
        <div className="mx-auto max-w-3xl">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1 text-xs font-medium text-violet-300">
            {t("combined_badge")}
          </div>
          <h1 className="text-2xl font-bold text-foreground sm:text-3xl">
            {t("combined_title")}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {t("combined_subtitle")}
          </p>
        </div>
      </div>

      <PricingSection />

      {/* One-Time Bundle — pay once, no monthly commitment */}
      <section className="mx-auto max-w-md px-6 pb-12 pt-4">
        <OneTimeBundleCard heygenHealthy={heygenHealthy} />
      </section>

      <ProductionCostCalculator />
    </main>
  );
}
