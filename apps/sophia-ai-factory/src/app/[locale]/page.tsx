import dynamic from "next/dynamic";
import { Hero } from "@/app/components/sections/hero";
import { Workflow } from "@/app/components/sections/workflow";

const Features = dynamic(() => import("@/app/components/sections/features").then(m => ({ default: m.Features })));
const SocialProof = dynamic(() => import("@/app/components/sections/social-proof").then(m => ({ default: m.SocialProof })));
const PricingSection = dynamic(() => import("@/components/pricing-section").then(m => ({ default: m.PricingSection })));
const AffiliateDiscovery = dynamic(() => import("@/app/components/sections/affiliate-discovery").then(m => ({ default: m.AffiliateDiscovery })));
const ROICalculator = dynamic(() => import("@/app/components/sections/roi-calculator").then(m => ({ default: m.ROICalculator })));
const FAQ = dynamic(() => import("@/app/components/sections/faq").then(m => ({ default: m.FAQ })));
const Footer = dynamic(() => import("@/app/components/layout/footer").then(m => ({ default: m.Footer })));

export default function Home() {
  return (
    <main>
      <Hero />
      <Workflow />
      <Features />
      <SocialProof />
      <PricingSection />
      <AffiliateDiscovery />
      <ROICalculator />
      <FAQ />
      <Footer />
    </main>
  );
}
