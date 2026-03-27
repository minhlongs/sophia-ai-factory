"use client";

import { useTranslations } from "next-intl";
import { Container } from "@/components/ui/container";
import { SectionHeading } from "@/components/ui/section-heading";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { FadeInView } from "@/components/ui/fade-in-view";
import { FileText, Zap, Mail, Users } from "lucide-react";

const RAAS_FEATURES = [
  {
    key: "proposal",
    icon: FileText,
    colorClass: "text-violet-400",
    bgClass: "bg-violet-500/10 border-violet-500/20",
  },
  {
    key: "lead",
    icon: Users,
    colorClass: "text-cyan-400",
    bgClass: "bg-cyan-500/10 border-cyan-500/20",
  },
  {
    key: "email",
    icon: Mail,
    colorClass: "text-emerald-400",
    bgClass: "bg-emerald-500/10 border-emerald-500/20",
  },
  {
    key: "commands",
    icon: Zap,
    colorClass: "text-amber-400",
    bgClass: "bg-amber-500/10 border-amber-500/20",
  },
] as const;

export function RaaSShowcase() {
  const t = useTranslations("landing.raas");

  return (
    <section id="raas" className="py-20 md:py-32 relative overflow-hidden">
      {/* Background glow — violet theme to distinguish from features section */}
      <div className="absolute top-1/2 left-1/4 w-[600px] h-[600px] bg-violet-600 opacity-8 blur-[140px] rounded-full -z-10" />
      <div className="absolute bottom-0 right-1/3 w-[400px] h-[400px] bg-cyan-500 opacity-8 blur-[100px] rounded-full -z-10" />
      {/* Top border accent */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-violet-500/40 to-transparent" />

      <Container>
        {/* Badge — shown FIRST to signal this is a distinct product */}
        <FadeInView duration={400}>
          <div className="flex justify-center mb-8">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-violet-400 bg-violet-500/10 rounded-full border border-violet-500/20">
              <Zap className="w-3.5 h-3.5" aria-hidden="true" />
              {t("badge")}
            </span>
          </div>
        </FadeInView>

        <SectionHeading
          title={t("title")}
          subtitle={t("subtitle")}
        />

        {/* Feature cards grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {RAAS_FEATURES.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <FadeInView key={feature.key} delay={index * 100} duration={500}>
                <Card glass hover className="h-full">
                  <CardHeader>
                    <div className={`w-12 h-12 rounded-lg border flex items-center justify-center mb-4 ${feature.bgClass}`}>
                      <Icon className={`w-6 h-6 ${feature.colorClass}`} aria-hidden="true" />
                    </div>
                    <CardTitle className="text-base mb-1">
                      {t(`features.${feature.key}.title`)}
                    </CardTitle>
                    <CardDescription>
                      {t(`features.${feature.key}.description`)}
                    </CardDescription>
                  </CardHeader>
                </Card>
              </FadeInView>
            );
          })}
        </div>

        {/* Stats bar */}
        <FadeInView delay={500} direction="none">
          <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-6 max-w-3xl mx-auto text-center">
            {(["stat1", "stat2", "stat3", "stat4"] as const).map((key) => (
              <div key={key}>
                <div className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent">
                  {t(`stats.${key}.value`)}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {t(`stats.${key}.label`)}
                </div>
              </div>
            ))}
          </div>
        </FadeInView>
      </Container>
    </section>
  );
}
