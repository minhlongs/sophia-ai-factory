import { PricingSection } from "@/components/pricing/pricing-section";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

export const metadata = {
  title: "Pricing - Sophia AI Factory",
  description: "Video Factory + AI Automation — One Platform",
};

export default async function PricingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const prefix = locale === "en" ? "" : `/${locale}`;
  const t = await getTranslations("pricing");

  return (
    <main className="min-h-screen bg-gradient-to-b from-black to-violet-950">
      <nav className="border-b border-white/10 px-6 py-4">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <Link href={`${prefix}/`} className="text-xl font-bold text-white">
            Sophia AI Factory
          </Link>
          <Link
            href={`${prefix}/dashboard`}
            className="rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/20"
          >
            {t("nav_dashboard")}
          </Link>
        </div>
      </nav>

      {/* Combined value messaging header */}
      <div className="border-b border-white/5 bg-gradient-to-r from-violet-900/30 to-blue-900/30 px-6 py-8 text-center">
        <div className="mx-auto max-w-3xl">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1 text-xs font-medium text-violet-300">
            {t("combined_badge")}
          </div>
          <h1 className="text-2xl font-bold text-white sm:text-3xl">
            {t("combined_title")}
          </h1>
          <p className="mt-2 text-sm text-white/60">
            {t("combined_subtitle")}
          </p>
        </div>
      </div>

      <PricingSection />
    </main>
  );
}
