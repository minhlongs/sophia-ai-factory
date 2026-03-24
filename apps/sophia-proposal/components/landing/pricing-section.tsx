"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { PRICING_TIERS } from "@/lib/pricing-config";
import { handleCheckout } from "@/components/pricing/pricing-cards";

export function PricingSection() {
  const [loadingTier, setLoadingTier] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  return (
    <section id="pricing" className="py-24 bg-surface-container">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <span className="inline-block px-4 py-1.5 mb-4 text-xs font-semibold uppercase tracking-wider text-primary bg-primary/5 rounded-full">
            Pricing
          </span>
          <h2 className="text-3xl md:text-4xl font-bold text-on-surface mb-4 tracking-tight">
            Simple, Transparent Pricing
          </h2>
          <p className="text-lg text-on-surface-variant max-w-2xl mx-auto leading-relaxed">
            Start free with 200 MCU. Scale as you grow.
          </p>
        </div>

        {checkoutError && (
          <div className="max-w-6xl mx-auto mb-6 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {checkoutError}
          </div>
        )}

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
          {PRICING_TIERS.map((tier) => (
            <div
              key={tier.id}
              className={`relative p-8 rounded-2xl card-hover ${
                tier.highlighted
                  ? "bg-gradient-to-br from-surface-dark-dim to-surface-dark text-on-surface-dark shadow-2xl shadow-primary/10 ring-1 ring-inverse-primary/20"
                  : "bg-surface-container-lowest text-on-surface border border-outline-variant/30"
              } ${tier.highlighted ? "md:scale-105" : ""}`}
            >
              {tier.highlighted && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-primary to-inverse-primary text-on-surface-dark text-sm font-bold px-4 py-1 rounded-full shadow-lg">
                  Most Popular
                </div>
              )}
              <div className="text-center mb-6">
                <h3 className="text-2xl font-bold mb-2 tracking-tight">{tier.name}</h3>
                <div className="flex items-baseline justify-center gap-1 mb-2">
                  <span className="text-4xl font-bold">{tier.price}</span>
                  <span className={tier.highlighted ? "text-on-surface-dark-variant" : "text-on-surface-variant"}>
                    /month
                  </span>
                </div>
                <p className={tier.highlighted ? "text-on-surface-dark-variant" : "text-on-surface-variant"}>
                  {tier.description}
                </p>
              </div>
              <ul className="space-y-4 mb-8">
                {tier.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-sm text-primary">
                      check_circle
                    </span>
                    <span className={tier.highlighted ? "text-on-surface-dark/80" : "text-on-surface"}>
                      {feature}
                    </span>
                  </li>
                ))}
              </ul>
              <Button
                variant={tier.highlighted ? "secondary" : "primary"}
                className="w-full"
                size="lg"
                disabled={loadingTier === tier.id}
                onClick={() => handleCheckout(tier.id, tier.cta, setLoadingTier, setCheckoutError)}
              >
                {loadingTier === tier.id ? "Loading..." : tier.cta}
              </Button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
