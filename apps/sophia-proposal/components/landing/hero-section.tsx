"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function HeroSection() {
  const router = useRouter();

  const handleGetStarted = () => {
    router.push("/signup");
  };

  const handleLearnMore = () => {
    router.push("/pricing");
  };

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gradient-to-br from-surface via-surface-container-low to-surface-container-highest">
      <div className="container mx-auto px-4 py-20 text-center">
        <div className="max-w-4xl mx-auto">
          <span className="inline-block px-4 py-1.5 mb-6 text-sm font-medium bg-primary-container text-on-primary-container rounded-full">
            For Digital Agencies
          </span>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-on-surface mb-6 tracking-tight">
            Sophia AI Factory
          </h1>
          <p className="text-xl md:text-2xl text-on-surface-variant mb-10 max-w-2xl mx-auto leading-relaxed">
            AI-powered proposals, sales decks, and content automation for agencies.
            Close more deals, faster — 200 free MCU to start.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button variant="primary" size="lg" onClick={handleGetStarted}>
              Start Free — 200 MCU
            </Button>
            <Button variant="outline" size="lg" onClick={handleLearnMore}>
              View Pricing
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
