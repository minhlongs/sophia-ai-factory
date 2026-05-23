"use client";

import { StatsBar } from "./social-proof-stats";
import { TestimonialsGrid } from "./social-proof-testimonials";

export function SocialProof() {
  return (
    <section className="py-28 relative overflow-hidden">
      <div className="absolute top-1/2 left-1/3 w-[600px] h-[600px] rounded-full blur-[150px] -z-10 bg-neon-cyan/[0.04]" />
      <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] rounded-full blur-[120px] -z-10 bg-neon-purple/[0.05]" />

      <div className="container mx-auto px-4">
        <StatsBar />
        <TestimonialsGrid />
      </div>
    </section>
  );
}
