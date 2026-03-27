import dynamic from "next/dynamic";
import { Hero } from "@/app/components/sections/hero";
import { Skeleton } from "@/components/ui/skeleton";

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
  () => import("@/components/pricing/pricing-section").then(m => ({ default: m.PricingSection })),
  { loading: () => <PricingSkeleton /> }
);
const AffiliateDiscovery = dynamic(
  () => import("@/app/components/sections/affiliate-discovery").then(m => ({ default: m.AffiliateDiscovery })),
  { loading: () => <SectionSkeleton /> }
);
const ROICalculator = dynamic(
  () => import("@/app/components/sections/roi-calculator").then(m => ({ default: m.ROICalculator })),
  { loading: () => <SectionSkeleton height="h-[500px]" /> }
);
const FAQ = dynamic(
  () => import("@/app/components/sections/faq").then(m => ({ default: m.FAQ })),
  { loading: () => <SectionSkeleton height="h-64" /> }
);
const Footer = dynamic(
  () => import("@/app/components/layout/footer").then(m => ({ default: m.Footer })),
  { loading: () => <Skeleton className="h-48 w-full" /> }
);

export default function Home() {
  return (
    <main id="main-content">
      <Hero />
      <Workflow />
      <Features />
      <RaaSShowcase />
      <RaasDemoTerminal />
      <SocialProof />
      <PricingSection />
      <AffiliateDiscovery />
      <ROICalculator />
      <FAQ />
      <Footer />
    </main>
  );
}
