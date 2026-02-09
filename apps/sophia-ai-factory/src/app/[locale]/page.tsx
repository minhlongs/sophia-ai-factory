import { Hero } from "@/app/components/sections/hero";
import { Workflow } from "@/app/components/sections/workflow";
import { Features } from "@/app/components/sections/features";
import { SocialProof } from "@/app/components/sections/social-proof";
import { PricingSection } from "@/components/pricing-section";
import { ROICalculator } from "@/app/components/sections/roi-calculator";
import { AffiliateDiscovery } from "@/app/components/sections/affiliate-discovery";
import { FAQ } from "@/app/components/sections/faq";
import { Footer } from "@/app/components/layout/footer";

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
