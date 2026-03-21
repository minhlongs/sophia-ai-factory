"use client";

import { Button } from "@/components/ui/button";
import { PRICING_TIERS } from "@/lib/pricing-config";

export function PricingSection() {
  return (
    <section className="py-20 bg-surface-container-highest">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-on-surface mb-4 tracking-tight">
            Simple, Transparent Pricing
          </h2>
          <p className="text-xl text-on-surface-variant max-w-2xl mx-auto leading-relaxed">
            Choose the plan that fits your needs
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {PRICING_TIERS.map((tier, index) => (
            <div
              key={tier.name}
              className={`relative p-8 rounded-2xl ${
                tier.highlighted
                  ? "bg-primary-container text-on-primary-container shadow-xl"
                  : "bg-surface text-on-surface"
              } ${index === 1 ? "md:scale-105" : ""}`}
            >
              {tier.highlighted && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-inverse-primary text-on-inverse-primary text-sm font-bold px-4 py-1 rounded-full">
                  Most Popular
                </div>
              )}
              <div className="text-center mb-6">
                <h3 className="text-2xl font-bold mb-2 tracking-tight">{tier.name}</h3>
                <div className="flex items-baseline justify-center gap-1 mb-2">
                  <span className="text-4xl font-bold">{tier.price}</span>
                  <span className={tier.highlighted ? "text-on-primary-container-variant" : "text-on-surface-variant"}>
                    /month
                  </span>
                </div>
                <p className={tier.highlighted ? "text-on-primary-container-variant" : "text-on-surface-variant"}>
                  {tier.description}
                </p>
              </div>
              <ul className="space-y-4 mb-8">
                {tier.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-sm text-primary">
                      check_circle
                    </span>
                    <span className={tier.highlighted ? "text-on-primary-container" : "text-on-surface"}>
                      {feature}
                    </span>
                  </li>
                ))}
              </ul>
              <Button
                variant={tier.highlighted ? "secondary" : "primary"}
                className="w-full"
                size="lg"
                onClick={() => {
                  const polarUrls: Record<string, string> = {
                    Starter: "https://buy.polar.sh/polar_cl_XvQ7Z2mN8kLpR3wY6tE1",
                    Growth: "https://buy.polar.sh/polar_cl_Y8rT4nM2jKpL5vX9wB3q",
                    Premium: "https://buy.polar.sh/polar_cl_Z1sW6pN4hGfD7xC2vM8t",
                  };
                  const checkoutUrl = polarUrls[tier.name];
                  if (checkoutUrl) {
                    window.open(checkoutUrl, "_blank");
                  }
                }}
              >
                {tier.cta}
              </Button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
