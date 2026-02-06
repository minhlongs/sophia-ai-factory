"use client";

import { useState } from "react";

// Pricing data - customers pay BOTH one-time setup AND monthly maintenance
const PRICING_TIERS = [
  {
    name: "Starter",
    description: "Perfect for getting started with AI video automation.",
    tier: "BASIC",
    setupPrice: 120000,     // $1,200 one-time
    maintenancePrice: 9900, // $99/month
    features: [
      "5 Video Templates",
      "Auto-Discovery Engine",
      "Basic Analytics",
      "Email Support",
    ],
  },
  {
    name: "Growth",
    description: "Scale your content production with advanced features.",
    tier: "PREMIUM",
    setupPrice: 200000,      // $2,000 one-time
    maintenancePrice: 19900, // $199/month
    features: [
      "Unlimited Templates",
      "Advanced Analytics",
      "ROI Calculator",
      "Priority Support",
      "Custom Branding",
    ],
    popular: true,
  },
  {
    name: "Premium",
    description: "Maximum power and support for enterprise needs.",
    tier: "ENTERPRISE",
    setupPrice: 300000,      // $3,000 one-time
    maintenancePrice: 49900, // $499/month
    features: [
      "Custom Templates",
      "White-labeling",
      "Dedicated Account Manager",
      "API Access",
      "SLA Guarantee",
    ],
  },
];

interface PricingCardProps {
  name: string;
  description: string;
  tier: string;
  setupPrice: number;
  maintenancePrice: number;
  features: string[];
  popular?: boolean;
  onSelect: (tier: string) => void;
  loading?: boolean;
}

function PricingCard({
  name,
  description,
  tier,
  setupPrice,
  maintenancePrice,
  features,
  popular,
  onSelect,
  loading,
}: PricingCardProps) {
  return (
    <div
      className={`relative flex flex-col rounded-2xl border p-8 ${
        popular
          ? "border-violet-500 bg-violet-500/5 shadow-lg shadow-violet-500/20"
          : "border-white/10 bg-white/5"
      }`}
    >
      {popular && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-violet-500 px-4 py-1 text-sm font-semibold text-white">
          Most Popular
        </span>
      )}
      <h3 className="text-xl font-bold text-white">{name}</h3>
      <p className="mt-2 text-sm text-white/60">{description}</p>

      {/* Pricing - Both one-time AND monthly */}
      <div className="mt-6 space-y-2">
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold text-white">
            ${(setupPrice / 100).toLocaleString()}
          </span>
          <span className="text-white/60">one-time setup</span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-xl font-semibold text-violet-400">
            + ${(maintenancePrice / 100).toLocaleString()}
          </span>
          <span className="text-white/60">/month maintenance</span>
        </div>
      </div>

      <ul className="mt-6 flex-1 space-y-3">
        {features.map((feature) => (
          <li key={feature} className="flex items-center gap-2 text-white/80">
            <svg
              className="h-5 w-5 text-violet-500"
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
            ? "bg-violet-500 text-white hover:bg-violet-600"
            : "bg-white/10 text-white hover:bg-white/20"
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
    } catch (error) {
      alert("Network error. Please try again.");
    } finally {
      setLoading(null);
    }
  };

  return (
    <section className="py-20" id="pricing">
      <div className="mx-auto max-w-7xl px-4">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-white sm:text-4xl">
            Choose Your Plan
          </h2>
          <p className="mt-4 text-lg text-white/60">
            One-time setup + monthly maintenance for ongoing support
          </p>
        </div>
        <div className="mt-12 grid gap-8 md:grid-cols-3">
          {PRICING_TIERS.map((pricing) => (
            <PricingCard
              key={pricing.tier}
              name={pricing.name}
              description={pricing.description}
              tier={pricing.tier}
              setupPrice={pricing.setupPrice}
              maintenancePrice={pricing.maintenancePrice}
              features={pricing.features}
              popular={pricing.popular}
              onSelect={handleSelectTier}
              loading={loading === pricing.tier}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
