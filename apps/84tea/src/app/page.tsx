import { HeroSection } from "@/components/home/hero-section";
import { StorySection } from "@/components/home/story-section";
import { FeaturedProducts } from "@/components/home/featured-products";
import { ProcessSection } from "@/components/home/process-section";
import { CTASection } from "@/components/home/cta-section";
import { MainLayout, FooterSection } from "@/components/layout";

export default function Home() {
  return (
    <div className="min-h-screen bg-surface flex flex-col">
      <MainLayout>
        <HeroSection />
        <StorySection />
        <FeaturedProducts />
        <ProcessSection />
        <CTASection />
        <FooterSection />
      </MainLayout>
    </div>
  );
}
