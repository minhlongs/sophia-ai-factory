import dynamic from "next/dynamic";
import { getTranslations } from "next-intl/server";

// Marketing homepage — cache at the edge for 60s with stale-while-revalidate.
// Translates to `Cache-Control: s-maxage=60, stale-while-revalidate=...` in Next 16.
export const revalidate = 60;

import { Hero } from "@/app/components/sections/hero";
import { Skeleton } from "@/seed/components/ui/skeleton";
import { ScrollReveal } from "@/seed/components/ui/scroll-reveal";
import { StickyMobileCta } from "@/app/components/layout/sticky-mobile-cta";
import { buildFAQPageSchema, buildOrganizationSchema } from "@/lib/seo/schema-org";
import { buildHomeMetadata } from "./home-metadata";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return buildHomeMetadata(locale);
}

function SectionSkeleton({ height = "h-96" }: { height?: string }) {
  return (
    <section className={`py-20 ${height}`}>
      <div className="container mx-auto px-4 space-y-8">
        <div className="text-center space-y-4">
          <Skeleton className="h-10 w-64 mx-auto" />
          <Skeleton className="h-6 w-96 mx-auto" />
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          <Skeleton className="h-48 rounded-xl" />
          <Skeleton className="h-48 rounded-xl" />
          <Skeleton className="h-48 rounded-xl" />
        </div>
      </div>
    </section>
  );
}

function PricingSkeleton() {
  return (
    <section className="py-20">
      <div className="container mx-auto px-4 space-y-8">
        <div className="text-center space-y-4">
          <Skeleton className="h-10 w-72 mx-auto" />
          <Skeleton className="h-6 w-96 mx-auto" />
        </div>
        <div className="grid md:grid-cols-3 gap-8 mt-12">
          <Skeleton className="h-[400px] rounded-2xl" />
          <Skeleton className="h-[440px] rounded-2xl" />
          <Skeleton className="h-[400px] rounded-2xl" />
        </div>
      </div>
    </section>
  );
}

const Workflow = dynamic(
  () => import("@/app/components/sections/workflow").then(m => ({ default: m.Workflow })),
  { loading: () => <SectionSkeleton height="h-80" /> }
);
const Features = dynamic(
  () => import("@/app/components/sections/features").then(m => ({ default: m.Features })),
  { loading: () => <SectionSkeleton /> }
);
const RaaSShowcase = dynamic(
  () => import("@/app/components/sections/raas-showcase").then(m => ({ default: m.RaaSShowcase })),
  { loading: () => <SectionSkeleton /> }
);
const RaasDemoTerminal = dynamic(
  () => import("@/app/components/sections/raas-demo-terminal").then(m => ({ default: m.RaasDemoTerminal })),
  { loading: () => <SectionSkeleton height="h-[500px]" /> }
);
const SocialProof = dynamic(
  () => import("@/app/components/sections/social-proof").then(m => ({ default: m.SocialProof })),
  { loading: () => <SectionSkeleton height="h-64" /> }
);
const PricingSection = dynamic(
  () => import("@/forest/components/pricing/pricing-section").then(m => ({ default: m.PricingSection })),
  { loading: () => <PricingSkeleton /> }
);
const AffiliateDiscovery = dynamic(
  () => import("@/app/components/sections/affiliate-discovery").then(m => ({ default: m.AffiliateDiscovery })),
  { loading: () => <SectionSkeleton /> }
);
const ProductionCostCalculator = dynamic(
  () => import("@/app/components/sections/production-cost-calculator").then(m => ({ default: m.ProductionCostCalculator })),
  { loading: () => <SectionSkeleton height="h-[500px]" /> }
);
const FAQ = dynamic(
  () => import("@/app/components/sections/faq").then(m => ({ default: m.FAQ })),
  { loading: () => <SectionSkeleton height="h-64" /> }
);
const CtaSection = dynamic(
  () => import("@/app/components/sections/cta-section").then(m => ({ default: m.CtaSection })),
  { loading: () => <SectionSkeleton height="h-64" /> }
);
const CreativeStudioShowcase = dynamic(
  () => import("@/app/components/sections/creative-studio-showcase").then(m => ({ default: m.CreativeStudioShowcase })),
  { loading: () => <SectionSkeleton /> }
);
const AgiCapabilitiesSection = dynamic(
  () => import("@/app/components/agi-capabilities-section"),
  { loading: () => <Skeleton className="h-96 w-full rounded-xl" /> }
);
const Footer = dynamic(
  () => import("@/app/components/layout/footer").then(m => ({ default: m.Footer })),
  { loading: () => <Skeleton className="h-48 w-full" /> }
);

const FAQ_KEYS = ['quality', 'copyright', 'time', 'skills', 'support', 'money', 'tiers', 'refund'] as const;

export default async function Home() {
  const t = await getTranslations('landing');
  const faqSchema = buildFAQPageSchema(
    FAQ_KEYS.map(key => ({
      q: t(`faq.items.${key}.question`),
      a: t(`faq.items.${key}.answer`),
    }))
  );
  const orgSchema = buildOrganizationSchema();

  return (
    <main id="main-content" className="max-w-full overflow-hidden">
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
      {/* Hero has its own FadeInView — no ScrollReveal needed */}
      <Hero />
      {/* Social proof immediately after hero — builds trust before asking for commitment */}
      <ScrollReveal delay={0}>
        <SocialProof />
      </ScrollReveal>
      <ScrollReveal delay={0}>
        <RaaSShowcase />
      </ScrollReveal>
      <ScrollReveal delay={100}>
        <Workflow />
      </ScrollReveal>
      <ScrollReveal delay={200}>
        <Features />
      </ScrollReveal>
      <ScrollReveal delay={100}>
        <CreativeStudioShowcase />
      </ScrollReveal>
      <ScrollReveal delay={100}>
        <RaasDemoTerminal />
      </ScrollReveal>
      {/* ROI calculator before pricing — show value before showing price */}
      <ProductionCostCalculator />
      <ScrollReveal delay={100}>
        <PricingSection />
      </ScrollReveal>
      <ScrollReveal delay={100}>
        <AgiCapabilitiesSection />
      </ScrollReveal>
      <ScrollReveal delay={0}>
        <AffiliateDiscovery />
      </ScrollReveal>
      <ScrollReveal delay={0}>
        <FAQ />
      </ScrollReveal>
      <ScrollReveal delay={0}>
        <CtaSection />
      </ScrollReveal>
      <Footer />
      <StickyMobileCta />
    </main>
  );
}
