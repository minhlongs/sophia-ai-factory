/**
 * Pricing display config — derives from POLAR_TIERS (single source of truth).
 * Used by landing page pricing section and marketing pages.
 */

import { POLAR_TIERS } from '@/lib/billing/polar-client';

export interface PricingTier {
  id: string;
  name: string;
  price: string;
  description: string;
  features: string[];
  cta: string;
  highlighted: boolean;
}

const TIER_DISPLAY: Record<string, { description: string; features: string[]; cta: string; highlighted: boolean }> = {
  starter: {
    description: "Perfect for side projects and small startups",
    features: [
      `${POLAR_TIERS.starter.mcuMonthly.toLocaleString()} MCU credits/month`,
      "5 AI commands",
      "Community support",
      "1 team member",
      "API access",
    ],
    cta: "Get Started",
    highlighted: false,
  },
  growth: {
    description: "For growing agencies and teams",
    features: [
      `${POLAR_TIERS.growth.mcuMonthly.toLocaleString()} MCU credits/month`,
      "All 15 AI commands",
      "Priority support",
      "5 team members",
      "API access + Webhooks",
      "Analytics dashboard",
    ],
    cta: "Start Growing",
    highlighted: true,
  },
  premium: {
    description: "For agencies with high-volume needs",
    features: [
      `${POLAR_TIERS.premium.mcuMonthly.toLocaleString()} MCU credits/month`,
      "All 15 AI commands",
      "24/7 dedicated support",
      "Unlimited team members",
      "Full API + Custom integrations",
      "Advanced analytics",
      "SLA guarantee",
    ],
    cta: "Go Premium",
    highlighted: false,
  },
  master: {
    description: "Enterprise-grade for large agencies",
    features: [
      `${POLAR_TIERS.master.mcuMonthly.toLocaleString()} MCU credits/month`,
      "All 15 AI commands + custom",
      "Dedicated account manager",
      "Unlimited team members",
      "Custom integrations + SSO",
      "White-label option",
      "99.9% SLA",
    ],
    cta: "Contact Sales",
    highlighted: false,
  },
};

export const PRICING_TIERS: PricingTier[] = Object.entries(POLAR_TIERS).map(([key, tier]) => {
  const display = TIER_DISPLAY[key];
  return {
    id: key,
    name: key.charAt(0).toUpperCase() + key.slice(1),
    price: `$${tier.price / 100}`,
    description: display?.description || '',
    features: display?.features || [],
    cta: display?.cta || 'Get Started',
    highlighted: display?.highlighted || false,
  };
});
