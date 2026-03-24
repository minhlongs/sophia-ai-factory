"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ScrollReveal } from "@/components/ui/scroll-reveal";

export function CtaSection() {
  const router = useRouter();

  return (
    <section className="py-28 bg-surface">
      <div className="container mx-auto px-4">
        <ScrollReveal>
          <div className="relative max-w-4xl mx-auto rounded-3xl bg-gradient-to-br from-[#060d16] via-surface-dark to-[#0a1929] p-12 md:p-16 text-center overflow-hidden">
            {/* Decorative orbs */}
            <div className="absolute top-0 left-0 w-72 h-72 bg-primary/15 rounded-full blur-[100px] pointer-events-none" aria-hidden="true" />
            <div className="absolute bottom-0 right-0 w-56 h-56 bg-inverse-primary/10 rounded-full blur-[80px] pointer-events-none" aria-hidden="true" />

            {/* Dot pattern */}
            <div
              className="absolute inset-0 opacity-[0.03]"
              aria-hidden="true"
              style={{
                backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.5) 1px, transparent 1px)",
                backgroundSize: "24px 24px",
              }}
            />

            <div className="relative">
              <h2 className="text-3xl md:text-5xl font-extrabold text-on-surface-dark mb-5 tracking-tight leading-tight">
                Ready to Automate
                <span className="block text-gradient mt-1">Your Agency?</span>
              </h2>
              <p className="text-on-surface-dark-variant/80 text-lg mb-10 max-w-xl mx-auto leading-relaxed">
                Join 50+ agencies already using Sophia AI Factory.
                Start with 200 free MCU credits — no credit card required.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button
                  variant="primary"
                  size="lg"
                  className="glow-primary cursor-pointer rounded-full px-10 text-base"
                  onClick={() => router.push("/signup")}
                >
                  <span className="material-symbols-outlined text-lg mr-2">rocket_launch</span>
                  Start Free Today
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  className="border-on-surface-dark/20 text-on-surface-dark hover:bg-on-surface-dark/10 cursor-pointer rounded-full px-10 text-base"
                  onClick={() => router.push("/docs/api")}
                >
                  <span className="material-symbols-outlined text-lg mr-2">menu_book</span>
                  Read the Docs
                </Button>
              </div>
            </div>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
