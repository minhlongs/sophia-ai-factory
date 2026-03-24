"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { PRICING_TIERS } from "@/lib/pricing-config";
import { handleCheckout } from "@/components/pricing/pricing-cards";
import { ScrollReveal } from "@/components/ui/scroll-reveal";

export function PricingSection() {
  const [loadingTier, setLoadingTier] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  return (
    <section id="pricing" className="py-28 bg-surface-container">
      <div className="container mx-auto px-4">
        <ScrollReveal className="text-center mb-20">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 mb-5 text-xs font-semibold uppercase tracking-wider text-primary bg-primary/5 rounded-full border border-primary/10">
            <span className="material-symbols-outlined text-sm">payments</span>
            Pricing
          </span>
          <h2 className="text-3xl md:text-5xl font-bold text-on-surface mb-5 tracking-tight">
            Simple,{" "}
            <span className="text-primary">Transparent</span> Pricing
          </h2>
          <p className="text-lg text-on-surface-variant max-w-2xl mx-auto leading-relaxed">
            Start free with 200 MCU. Scale as you grow. No hidden fees.
          </p>
        </ScrollReveal>

        {checkoutError && (
          <div className="max-w-6xl mx-auto mb-6 rounded-2xl bg-error-container border border-error/20 px-5 py-3 text-sm text-on-error-container">
            {checkoutError}
          </div>
        )}

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5 max-w-6xl mx-auto">
          {PRICING_TIERS.map((tier, i) => (
            <ScrollReveal key={tier.id} delay={i * 80}>
              <div
                className={`relative group h-full rounded-2xl transition-all duration-300 cursor-pointer ${
                  tier.highlighted
                    ? "bg-gradient-to-br from-[#060d16] to-surface-dark text-on-surface-dark shadow-2xl shadow-primary/15 ring-1 ring-inverse-primary/25 md:scale-105 animate-glow-pulse"
                    : "gradient-border hover:shadow-md3-2"
                }`}
              >
                {tier.highlighted && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-gradient-to-r from-primary to-inverse-primary text-white text-xs font-bold px-4 py-1 rounded-full shadow-lg">
                    Most Popular
                  </div>
                )}

                <div className={`p-7 rounded-2xl h-full flex flex-col ${!tier.highlighted ? 'bg-surface-container-lowest' : ''}`}>
                  {/* Tier header */}
                  <div className="text-center mb-6">
                    <h3 className="text-xl font-bold mb-3 tracking-tight">{tier.name}</h3>
                    <div className="flex items-baseline justify-center gap-1 mb-2">
                      <span className="text-4xl font-extrabold tracking-tight">{tier.price}</span>
                      <span className={`text-sm ${tier.highlighted ? "text-on-surface-dark-variant" : "text-on-surface-variant"}`}>
                        /month
                      </span>
                    </div>
                    <p className={`text-sm ${tier.highlighted ? "text-on-surface-dark-variant" : "text-on-surface-variant"}`}>
                      {tier.description}
                    </p>
                  </div>

                  {/* Features */}
                  <ul className="space-y-3 mb-8 flex-1">
                    {tier.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2.5">
                        <span className={`material-symbols-outlined text-base flex-shrink-0 mt-0.5 ${tier.highlighted ? "text-inverse-primary" : "text-primary"}`}>
                          check_circle
                        </span>
                        <span className={`text-sm leading-relaxed ${tier.highlighted ? "text-on-surface-dark/80" : "text-on-surface-variant"}`}>
                          {feature}
                        </span>
                      </li>
                    ))}
                  </ul>

                  {/* CTA */}
                  <Button
                    variant={tier.highlighted ? "secondary" : "primary"}
                    className={`w-full rounded-full ${tier.highlighted ? "" : "group-hover:shadow-md3-1"}`}
                    size="lg"
                    disabled={loadingTier === tier.id}
                    onClick={() => handleCheckout(tier.id, tier.cta, setLoadingTier, setCheckoutError)}
                  >
                    {loadingTier === tier.id ? (
                      <span className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-base animate-spin">progress_activity</span>
                        Loading...
                      </span>
                    ) : tier.cta}
                  </Button>
                </div>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
