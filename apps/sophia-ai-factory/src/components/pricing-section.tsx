"use client";

import { useState } from "react";
import { POLAR_PRODUCTS } from "@/lib/polar-config";

interface PricingCardProps {
  name: string;
  description: string;
  tier: string;
  price: number;
  features: string[];
  popular?: boolean;
  onSelect: (tier: string) => void;
  loading?: boolean;
}

function PricingCard({
  name,
  description,
  tier,
  price,
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
      <div className="mt-6">
        <span className="text-4xl font-bold text-white">
          ${(price / 100).toLocaleString()}
        </span>
        <span className="text-white/60">/one-time</span>
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

const TIER_FEATURES: Record<string, string[]> = {
  BASIC: [
    "1 YouTube Channel",
    "5 Video Templates",
    "Basic Analytics",
    "Email Support",
  ],
  PREMIUM: [
    "3 YouTube Channels",
    "Unlimited Templates",
    "Advanced Analytics",
    "Priority Support",
    "Custom Branding",
  ],
  ENTERPRISE: [
    "Unlimited Channels",
    "Custom Templates",
    "White-labeling",
    "Dedicated Account Manager",
    "API Access",
    "SLA Guarantee",
  ],
};

export function PricingSection() {
  const [loading, setLoading] = useState<string | null>(null);

  const handleSelectTier = async (tier: string) => {
    setLoading(tier);
    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier }),
      });

      const data = await response.json();

      if (data.url) {
        window.location.href = data.url;
      } else {
        console.error("Checkout error:", data.error);
        alert("Failed to start checkout. Please try again.");
      }
    } catch (error) {
      console.error("Checkout request failed:", error);
      alert("Network error. Please try again.");
    } finally {
      setLoading(null);
    }
  };

  return (
    <section className="py-20">
      <div className="mx-auto max-w-7xl px-4">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-white sm:text-4xl">
            Choose Your Plan
          </h2>
          <p className="mt-4 text-lg text-white/60">
            Start automating your video content today
          </p>
        </div>
        <div className="mt-12 grid gap-8 md:grid-cols-3">
          {POLAR_PRODUCTS.map((product, index) => (
            <PricingCard
              key={product.tier}
              name={product.name.replace("Sophia AI Factory - ", "")}
              description={product.description}
              tier={product.tier}
              price={product.prices[0].priceAmount}
              features={TIER_FEATURES[product.tier] || []}
              popular={index === 1}
              onSelect={handleSelectTier}
              loading={loading === product.tier}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
