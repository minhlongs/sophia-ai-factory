import { ErrorBoundary } from "../components/error-boundary";
import { HeroSection } from "../components/landing/hero-section";
import { FeaturesSection } from "../components/landing/features-section";
import { ProposalGeneratorSection } from "../components/landing/proposal-generator-section";
import { PricingSection } from "../components/landing/pricing-section";

export default function Home() {
  return (
    <ErrorBoundary>
      <HeroSection />
      <FeaturesSection />
      <ProposalGeneratorSection />
      <PricingSection />
    </ErrorBoundary>
  );
}
