"use client";

import { Container } from "@/components/ui/container";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { SectionHeading } from "@/components/ui/section-heading";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { Zap, Users, Mic, TrendingUp, Bot, Globe } from "lucide-react";

const features = [
  {
    title: "Multi-Channel Distribution",
    description: "Manage 5+ YouTube channels from one dashboard. Scale your content empire effortlessly.",
    icon: Users,
    badge: "Premium",
    size: "large", // Takes 2 columns
  },
  {
    title: "Auto-Affiliate Integration",
    description: "Automatically insert affiliate links into video descriptions with smart tracking.",
    icon: TrendingUp,
    badge: "Enterprise",
    size: "small",
  },
  {
    title: "KOL Voice Cloning",
    description: "Clone your voice with AI. Sound like a pro in every video without recording.",
    icon: Mic,
    badge: "Premium",
    size: "small",
  },
  {
    title: "AI Script Generation",
    description: "Generate engaging scripts for any niche in seconds. SEO-optimized and conversion-focused.",
    icon: Bot,
    badge: "Basic",
    size: "small",
  },
  {
    title: "24/7 Auto-Publishing",
    description: "Schedule and publish videos automatically. Your content factory never sleeps.",
    icon: Zap,
    badge: "Premium",
    size: "small",
  },
  {
    title: "Global Reach",
    description: "Translate and localize content for international audiences automatically.",
    icon: Globe,
    badge: "Enterprise",
    size: "large",
  },
];

export function Features() {
  return (
    <section id="features" className="py-20 md:py-32 relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-[var(--neon-purple)] opacity-10 blur-[150px] rounded-full -z-10" />

      <Container>
        <SectionHeading
          title="Everything You Need to Dominate"
          subtitle="Powerful features designed for serious content creators"
        />

        {/* Bento Grid */}
        <div className="grid md:grid-cols-4 gap-6 auto-rows-fr">
          {features.map((feature, index) => {
            const Icon = feature.icon;

            return (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className={
                  feature.size === "large"
                    ? "md:col-span-2 md:row-span-1"
                    : "md:col-span-1"
                }
              >
                <Card glass hover className="h-full">
                  <CardHeader>
                    <div className="flex items-start justify-between mb-4">
                      <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-[var(--neon-cyan)]/20 to-[var(--neon-purple)]/20 flex items-center justify-center">
                        <Icon className="w-6 h-6 text-[var(--neon-cyan)]" />
                      </div>
                      <Badge
                        variant={
                          feature.badge === "Basic"
                            ? "basic"
                            : feature.badge === "Premium"
                            ? "premium"
                            : "enterprise"
                        }
                      >
                        {feature.badge}
                      </Badge>
                    </div>

                    <CardTitle className="text-xl mb-2">{feature.title}</CardTitle>
                    <CardDescription>{feature.description}</CardDescription>
                  </CardHeader>
                </Card>
              </motion.div>
            );
          })}
        </div>

        {/* Feature highlight */}
        <motion.div
          className="mt-16 text-center"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.8 }}
        >
          <Card glass className="max-w-2xl mx-auto bg-card border-border">
            <CardContent className="pt-6">
              <p className="text-muted-foreground">
                <span className="text-[var(--neon-cyan)] font-semibold">
                  Enterprise tier
                </span>{" "}
                unlocks API integrations with PartnerStack, Impact.com, and weekly
                auto-updates of affiliate programs.
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </Container>
    </section>
  );
}
