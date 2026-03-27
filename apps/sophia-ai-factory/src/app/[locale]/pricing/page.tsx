import { PricingSection } from "@/components/pricing/pricing-section";
import Link from "next/link";

export const metadata = {
  title: "Pricing - Sophia AI Factory",
  description: "Choose your plan for AI-powered video automation",
};

export default async function PricingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const prefix = locale === "en" ? "" : `/${locale}`;

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
            Dashboard
          </Link>
        </div>
      </nav>
      <PricingSection />
    </main>
  );
}
