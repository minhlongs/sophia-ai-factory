"use client";

import { useTranslations } from "next-intl";
import { Brain, TrendingUp, Bot, Zap, FileCheck, BarChart3 } from "lucide-react";;import { FadeInView } from "@/seed/components/ui/fade-in-view";
import { Container } from "@/seed/components/ui/container";

const CAPABILITIES = [
  {
    key: "outcome_tracking",
    icon: BarChart3,
    iconColor: "text-emerald-400",
    borderHover: "hover:border-emerald-500/50",
    shadowHover: "hover:shadow-emerald-500/20",
    glowColor: "bg-emerald-500/10",
  },
  {
    key: "confidence",
    icon: Brain,
    iconColor: "text-accent-400",
    borderHover: "hover:border-accent-500/50",
    shadowHover: "hover:shadow-cyan-500/20",
    glowColor: "bg-accent-500/10",
  },
  {
    key: "multi_agent",
    icon: Bot,
    iconColor: "text-purple-400",
    borderHover: "hover:border-purple-500/50",
    shadowHover: "hover:shadow-purple-500/20",
    glowColor: "bg-purple-500/10",
  },
  {
    key: "pricing",
    icon: TrendingUp,
    iconColor: "text-emerald-400",
    borderHover: "hover:border-emerald-500/50",
    shadowHover: "hover:shadow-emerald-500/20",
    glowColor: "bg-emerald-500/10",
  },
  {
    key: "feedback",
    icon: Zap,
    iconColor: "text-accent-400",
    borderHover: "hover:border-accent-500/50",
    shadowHover: "hover:shadow-cyan-500/20",
    glowColor: "bg-accent-500/10",
  },
  {
    key: "compliance",
    icon: FileCheck,
    iconColor: "text-purple-400",
    borderHover: "hover:border-purple-500/50",
    shadowHover: "hover:shadow-purple-500/20",
    glowColor: "bg-purple-500/10",
  },
] as const;

export default function AgiCapabilitiesSection() {
  const t = useTranslations("agi_showcase");

  return (
    <section
      id="agi-capabilities"
      className="relative py-20 md:py-32 overflow-hidden bg-gradient-to-b from-background to-muted"
    >
      {/* Background ambient glows */}
      <div className="absolute top-1/3 left-1/4 w-[500px] h-[500px] bg-emerald-600 opacity-[0.06] blur-[140px] rounded-full -z-10" />
      <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-accent-500 opacity-[0.06] blur-[120px] rounded-full -z-10" />
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-emerald-500/30 to-transparent" />

      <Container>
        {/* Section header */}
        <FadeInView duration={500} className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-sm font-medium mb-6">
            <Brain className="w-4 h-4" />
            <span>AGI-Ready Infrastructure</span>
          </div>
          <h2 className="text-3xl md:text-5xl font-bold text-white mb-4 leading-tight">
            {t("title")}
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            {t("subtitle")}
          </p>
        </FadeInView>

        {/* Capabilities grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {CAPABILITIES.map(
            ({ key, icon: Icon, iconColor, borderHover, shadowHover, glowColor }, index) => (
              <FadeInView
                key={key}
                delay={index * 80}
                duration={500}
                direction="up"
              >
                <div
                  className={[
                    "relative group h-full p-6 rounded-2xl",
                    "bg-muted backdrop-blur-xl",
                    "border border-border transition-all duration-300",
                    borderHover,
                    `hover:shadow-lg ${shadowHover}`,
                  ].join(" ")}
                >
                  {/* Card glow on hover */}
                  <div
                    className={[
                      "absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300",
                      glowColor,
                    ].join(" ")}
                  />

                  <div className="relative z-10">
                    {/* Icon */}
                    <div className="mb-4">
                      <Icon className={`w-12 h-12 ${iconColor}`} strokeWidth={1.5} />
                    </div>

                    {/* Title */}
                    <h3 className="text-white font-semibold text-lg mb-2">
                      {t(`${key}_title` as Parameters<typeof t>[0])}
                    </h3>

                    {/* Description */}
                    <p className="text-muted-foreground text-sm leading-relaxed">
                      {t(`${key}_desc` as Parameters<typeof t>[0])}
                    </p>
                  </div>
                </div>
              </FadeInView>
            )
          )}
        </div>
      </Container>
    </section>
  );
}
