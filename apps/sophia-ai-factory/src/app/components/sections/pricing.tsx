"use client";

import { Container } from "@/app/components/ui/container";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/app/components/ui/card";
import { Badge } from "@/app/components/ui/badge";
import { Button } from "@/app/components/ui/button";
import { SectionHeading } from "@/app/components/ui/section-heading";
import { TIER_CONFIGS } from "@/config/tiers";
import { motion } from "framer-motion";
import { Check } from "lucide-react";

const tierFeatures = {
  BASIC: [
    "Landing Page MAX WOW",
    "9 Premium Sections",
    "Mobile Responsive",
    "Vercel Deployment",
    "Email Support",
  ],
  PREMIUM: [
    "Everything in Basic",
    "Affiliate Engine Lite",
    "Top 50 Programs",
    "ROI Calculator Tool",
    "Monthly Reports",
    "Email + Chat Support",
  ],
  ENTERPRISE: [
    "Everything in Premium",
    "Auto-Discovery Engine",
    "Unlimited Programs",
    "Admin Dashboard",
    "API Integrations",
    "Weekly Auto-Updates",
    "Priority 24/7 Support",
  ],
};

export function Pricing() {
  const tiers = ["BASIC", "PREMIUM", "ENTERPRISE"] as const;

  return (
    <section className="py-20 md:py-32 relative">
      {/* Background glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-[var(--neon-cyan)] opacity-10 blur-[150px] rounded-full -z-10" />

      <Container>
        <SectionHeading
          title="Choose Your Path to Success"
          subtitle="Transparent pricing. No hidden fees. Cancel anytime."
        />

        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {tiers.map((tierKey, index) => {
            const tier = TIER_CONFIGS[tierKey];
            const isRecommended = tierKey === "PREMIUM";

            return (
              <motion.div
                key={tierKey}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className={isRecommended ? "md:-mt-4" : ""}
              >
                <Card
                  glass
                  hover
                  className={`h-full relative ${
                    isRecommended
                      ? "border-2 border-[var(--neon-purple)] shadow-[0_0_40px_rgba(112,0,255,0.3)]"
                      : ""
                  }`}
                >
                  {isRecommended && (
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                      <Badge variant="premium" className="px-6 py-2">
                        ⭐ Recommended
                      </Badge>
                    </div>
                  )}

                  <CardHeader>
                    <div className="mb-6">
                      <CardTitle className="text-2xl mb-2">{tier.name}</CardTitle>
                      <div className="flex items-baseline gap-2">
                        <span className="text-4xl font-bold text-white">
                          ${tier.price.toLocaleString()}
                        </span>
                        <span className="text-gray-500">one-time</span>
                      </div>
                    </div>

                    <CardDescription className="text-base mb-6">
                      {tierKey === "BASIC" && "Perfect for getting started"}
                      {tierKey === "PREMIUM" && "Best for serious creators"}
                      {tierKey === "ENTERPRISE" && "Full automation system"}
                    </CardDescription>

                    <Button
                      variant={isRecommended ? "glow" : "secondary"}
                      className="w-full mb-6"
                    >
                      Get Started
                    </Button>
                  </CardHeader>

                  <CardContent>
                    <ul className="space-y-3">
                      {tierFeatures[tierKey].map((feature) => (
                        <li key={feature} className="flex items-start gap-3">
                          <div className="mt-1">
                            <Check className="w-4 h-4 text-[var(--neon-cyan)]" />
                          </div>
                          <span className="text-gray-300 text-sm">{feature}</span>
                        </li>
                      ))}
                    </ul>

                    {/* Monthly pricing note */}
                    {tierKey !== "BASIC" && (
                      <div className="mt-6 pt-6 border-t border-white/10">
                        <p className="text-xs text-gray-500">
                          + ${tierKey === "PREMIUM" ? "100" : "300"}/month maintenance
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>

        {/* Trust badge */}
        <motion.div
          className="text-center mt-12"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.6 }}
        >
          <p className="text-gray-500 text-sm">
            30-day money-back guarantee • Source code included • No hidden fees
          </p>
        </motion.div>
      </Container>
    </section>
  );
}
