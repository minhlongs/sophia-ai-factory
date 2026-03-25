import { ErrorBoundary } from "../components/error-boundary";
import { Navbar } from "../components/landing/navbar";
import { HeroSection } from "../components/landing/hero-section";
import { FeaturesSection } from "../components/landing/features-section";
import { HowItWorksSection } from "../components/landing/how-it-works-section";
import { ProposalGeneratorSection } from "../components/landing/proposal-generator-section";
import { DemoSection } from "../components/landing/demo-section";
import { SocialProofSection } from "../components/landing/social-proof-section";
import { PricingSection } from "../components/landing/pricing-section";
import { FaqSection } from "../components/landing/faq-section";
import { CtaSection } from "../components/landing/cta-section";
import { Footer } from "../components/landing/footer";

export default function Home() {
  return (
    <ErrorBoundary>
      <Navbar />
      <HeroSection />
      <FeaturesSection />
      <HowItWorksSection />
      <ProposalGeneratorSection />
      <DemoSection />
      <SocialProofSection />
      <PricingSection />
      <FaqSection />
      <CtaSection />
      <Footer />
    </ErrorBoundary>
  );
}
