import { HeroSection } from "@/components/home/hero-section";
import { StorySection } from "@/components/home/story-section";
import { FeaturedProducts } from "@/components/home/featured-products";
import { ProcessSection } from "@/components/home/process-section";
import { CTASection } from "@/components/home/cta-section";
import { HeaderNavigation, FooterSection } from "@/components/layout";

export default function Home() {
  return (
    <div className="min-h-screen bg-surface flex flex-col">
      <HeaderNavigation />

      <main className="flex-1">
        <HeroSection />
        <StorySection />
        <FeaturedProducts />
        <ProcessSection />
        <CTASection />
      </main>

      <FooterSection />
    </div>
  );
}
