import { Hero } from "./components/sections/hero";
import { Workflow } from "./components/sections/workflow";
import { Features } from "./components/sections/features";
import { PricingSection } from "@/components/pricing-section";
import { ROICalculator } from "./components/sections/roi-calculator";
import { AffiliateDiscovery } from "./components/sections/affiliate-discovery";
import { FAQ } from "./components/sections/faq";
import { Footer } from "./components/layout/footer";

export default function Home() {
  return (
    <main>
      <Hero />
      <Workflow />
      <Features />
      <PricingSection />
      <AffiliateDiscovery />
      <ROICalculator />
      <FAQ />
      <Footer />
    </main>
  );
}
