"use client";

import { useTranslations } from "next-intl";
import { Container } from "@/components/ui/container";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { SectionHeading } from "@/components/ui/section-heading";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { Zap, Users, Mic, TrendingUp, Bot, Globe } from "lucide-react";

const badgeVariants: Record<string, "basic" | "premium" | "enterprise"> = {
  "Starter": "basic",
  "Growth": "premium",
  "Premium": "enterprise",
};

export function Features() {
  const t = useTranslations("landing");

  const features = [
    {
      title: t("features.items.multi_channel.title"),
      description: t("features.items.multi_channel.description"),
      icon: Users,
      badge: t("features.items.multi_channel.badge"),
      size: "large",
    },
    {
      title: t("features.items.auto_affiliate.title"),
      description: t("features.items.auto_affiliate.description"),
      icon: TrendingUp,
      badge: t("features.items.auto_affiliate.badge"),
      size: "small",
    },
    {
      title: t("features.items.voice_cloning.title"),
      description: t("features.items.voice_cloning.description"),
      icon: Mic,
      badge: t("features.items.voice_cloning.badge"),
      size: "small",
    },
    {
      title: t("features.items.script_gen.title"),
      description: t("features.items.script_gen.description"),
      icon: Bot,
      badge: t("features.items.script_gen.badge"),
      size: "small",
    },
    {
      title: t("features.items.auto_publish.title"),
      description: t("features.items.auto_publish.description"),
      icon: Zap,
      badge: t("features.items.auto_publish.badge"),
      size: "small",
    },
    {
      title: t("features.items.global_reach.title"),
      description: t("features.items.global_reach.description"),
      icon: Globe,
      badge: t("features.items.global_reach.badge"),
      size: "large",
    },
  ];

  return (
    <section id="features" className="py-20 md:py-32 relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-[var(--neon-purple)] opacity-10 blur-[150px] rounded-full -z-10" />

      <Container>
        <SectionHeading
          title={t("features.title")}
          subtitle={t("features.subtitle")}
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
                        variant={badgeVariants[feature.badge] || "basic"}
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
                {t("features.highlight")}
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </Container>
    </section>
  );
}
