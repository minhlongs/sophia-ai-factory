export interface PricingTier {
  name: string;
  price: string;
  description: string;
  features: string[];
  cta: string;
  highlighted: boolean;
}

export const PRICING_TIERS: PricingTier[] = [
  {
    name: "Starter",
    price: "$49",
    description: "Perfect for side projects and small startups",
    features: [
      "200 MCU credits/month",
      "Basic AI agents",
      "Community support",
      "1 team member",
      "API access",
    ],
    cta: "Start Free Trial",
    highlighted: false,
  },
  {
    name: "Growth",
    price: "$149",
    description: "For growing teams and businesses",
    features: [
      "1,000 MCU credits/month",
      "Advanced AI agents",
      "Priority support",
      "5 team members",
      "API access + Webhooks",
      "Analytics dashboard",
    ],
    cta: "Start Free Trial",
    highlighted: true,
  },
  {
    name: "Premium",
    price: "$499",
    description: "For enterprises with custom needs",
    features: [
      "Unlimited MCU credits",
      "Custom AI agents",
      "24/7 dedicated support",
      "Unlimited team members",
      "Full API + Custom integrations",
      "Advanced analytics",
      "SLA guarantee",
    ],
    cta: "Contact Sales",
    highlighted: false,
  },
];
