"use client";

import { useState } from "react";

// Option D: Single monthly subscription with 12-month commitment
const PRICING_TIERS = [
  {
    name: "Starter",
    description: "Complete AI video automation. 12-month commitment.",
    tier: "BASIC",
    monthlyPrice: 19900, // $199/mo
    features: [
      "5 Video Templates",
      "Auto-Discovery Engine",
      "Basic Analytics Dashboard",
      "Email Support (48h response)",
    ],
  },
  {
    name: "Growth",
    description: "Scale your content production. 12-month commitment.",
    tier: "PREMIUM",
    monthlyPrice: 39900, // $399/mo
    features: [
      "Unlimited Templates",
      "Advanced Analytics & Reports",
      "ROI Calculator",
      "Priority Support (24h response)",
      "Custom Brand Setup",
    ],
    popular: true,
  },
  {
    name: "Premium",
    description: "Enterprise power and support. 12-month commitment.",
    tier: "ENTERPRISE",
    monthlyPrice: 79900, // $799/mo
    features: [
      "Custom Templates",
      "White-label Setup",
      "Direct Founder Access",
      "API Access",
      "99.9% Uptime SLA",
    ],
  },
];

// Binh Pháp upsell: Master one-time package
const MASTER_TIER = {
  name: "Master",
  description: "Lifetime access. One payment. Everything included forever.",
  tier: "MASTER",
  price: 499900, // $4,999 one-time
  features: [
    "Everything in Premium",
    "Lifetime Access & Updates",
    "1-on-1 Onboarding & Training",
    "VIP Priority Support Forever",
    "Custom Automation Scripts",
    "Monthly Strategy Review",
    "Full White-label License",
    "Early Access to Beta Features",
  ],
};

interface PricingCardProps {
  name: string;
  description: string;
  tier: string;
  monthlyPrice: number;
  features: string[];
  popular?: boolean;
  onSelect: (tier: string) => void;
  loading?: boolean;
}

function PricingCard({
  name,
  description,
  tier,
  monthlyPrice,
  features,
  popular,
  onSelect,
  loading,
}: PricingCardProps) {
  return (
    <div
      className={`relative flex flex-col rounded-2xl border p-8 transition-colors ${
        popular
          ? "border-primary bg-primary/5 shadow-lg shadow-primary/20"
          : "border-border bg-card"
      }`}
    >
      {popular && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-4 py-1 text-sm font-semibold text-primary-foreground">
          Most Popular
        </span>
      )}
      <h3 className="text-xl font-bold text-foreground">{name}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>

      {/* Option D: Single monthly price */}
      <div className="mt-6">
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold text-foreground">
            ${(monthlyPrice / 100).toLocaleString()}
          </span>
          <span className="text-muted-foreground">/month</span>
        </div>
        <span className="mt-1 inline-block rounded bg-primary/10 px-2 py-0.5 text-xs text-primary">
          12-month commitment
        </span>
      </div>

      <ul className="mt-6 flex-1 space-y-3">
        {features.map((feature) => (
          <li key={feature} className="flex items-center gap-2 text-muted-foreground">
            <svg
              className="h-5 w-5 text-primary"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
            {feature}
          </li>
        ))}
      </ul>

      <button
        onClick={() => onSelect(tier)}
        disabled={loading}
        className={`mt-8 w-full rounded-lg py-3 font-semibold transition ${
          popular
            ? "bg-primary text-primary-foreground hover:bg-primary/90"
            : "bg-muted text-foreground hover:bg-muted/80"
        } disabled:cursor-not-allowed disabled:opacity-50`}
      >
        {loading ? "Processing..." : "Get Started"}
      </button>
    </div>
  );
}

export function PricingSection() {
  const [loading, setLoading] = useState<string | null>(null);

  const handleSelectTier = async (tier: string) => {
    setLoading(tier);
    try {
      // Checkout will handle both one-time setup and monthly subscription
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier }),
      });

      const data = await response.json();

      if (data.url) {
        window.location.href = data.url;
      } else {
        alert("Failed to start checkout. Please try again.");
      }
    } catch {
      alert("Network error. Please try again.");
    } finally {
      setLoading(null);
    }
  };

  return (
    <section className="py-20 bg-background" id="pricing">
      <div className="mx-auto max-w-7xl px-4">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-foreground sm:text-4xl">
            Choose Your Plan
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Simple monthly pricing with everything included
          </p>
        </div>
        <div className="mt-12 grid gap-8 md:grid-cols-3">
          {PRICING_TIERS.map((pricing) => (
            <PricingCard
              key={pricing.tier}
              name={pricing.name}
              description={pricing.description}
              tier={pricing.tier}
              monthlyPrice={pricing.monthlyPrice}
              features={pricing.features}
              popular={pricing.popular}
              onSelect={handleSelectTier}
              loading={loading === pricing.tier}
            />
          ))}
        </div>

        {/* Binh Pháp Master Upsell */}
        <div className="mt-16 relative">
          <div className="rounded-2xl border-2 border-primary bg-gradient-to-br from-primary/10 via-background to-primary/5 p-8 md:p-12 shadow-xl shadow-primary/10">
            <span className="absolute -top-4 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-primary to-purple-600 px-6 py-1.5 text-sm font-bold text-white shadow-lg">
              ⚡ Best Value — Save 48%
            </span>
            <div className="grid md:grid-cols-2 gap-8 items-center">
              <div>
                <h3 className="text-2xl font-bold text-foreground md:text-3xl">
                  {MASTER_TIER.name}
                </h3>
                <p className="mt-2 text-muted-foreground">
                  {MASTER_TIER.description}
                </p>
                <div className="mt-6">
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-bold text-foreground">
                      ${(MASTER_TIER.price / 100).toLocaleString()}
                    </span>
                    <span className="text-muted-foreground">one-time</span>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    <span className="line-through">$9,588</span>{" "}
                    <span className="text-primary font-semibold">
                      vs $799/mo × 12 months
                    </span>
                  </p>
                </div>
                <button
                  onClick={() => handleSelectTier(MASTER_TIER.tier)}
                  disabled={loading === MASTER_TIER.tier}
                  className="mt-8 w-full md:w-auto rounded-lg bg-gradient-to-r from-primary to-purple-600 px-10 py-4 font-bold text-white text-lg shadow-lg hover:opacity-90 transition disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading === MASTER_TIER.tier ? "Processing..." : "Get Lifetime Access"}
                </button>
              </div>
              <ul className="space-y-3">
                {MASTER_TIER.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-3 text-foreground">
                    <svg
                      className="h-5 w-5 text-primary flex-shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    <span className="font-medium">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

