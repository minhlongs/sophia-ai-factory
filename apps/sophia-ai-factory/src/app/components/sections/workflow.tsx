"use client";

import { useTranslations } from "next-intl";
import { Container } from "@/seed/components/ui/container";
import { Card, CardHeader, CardTitle, CardDescription } from "@/seed/components/ui/card";
import { SectionHeading } from "@/seed/components/ui/section-heading";
import { FadeInView } from "@/seed/components/ui/fade-in-view";
import { ArrowRight } from "lucide-react";

export function Workflow() {
  const t = useTranslations('landing');

  const steps = [
    {
      number: "01",
      title: t('workflow.steps.select_niche.title'),
      description: t('workflow.steps.select_niche.description'),
      icon: "🎯",
    },
    {
      number: "02",
      title: t('workflow.steps.ai_generate.title'),
      description: t('workflow.steps.ai_generate.description'),
      icon: "🤖",
    },
    {
      number: "03",
      title: t('workflow.steps.publish.title'),
      description: t('workflow.steps.publish.description'),
      icon: "🚀",
    },
    {
      number: "04",
      title: t('workflow.steps.profit.title'),
      description: t('workflow.steps.profit.description'),
      icon: "💰",
    },
  ];
  return (
    <section className="py-20 md:py-32">
      <Container>
        <SectionHeading
          title={t('workflow.title')}
          subtitle={t('workflow.subtitle')}
        />

        <div className="grid md:grid-cols-4 gap-8 relative">
          {/* Connecting lines (desktop only) */}
          <div className="hidden md:block absolute top-1/2 left-0 right-0 h-0.5 bg-gradient-to-r from-[var(--neon-cyan)] to-[var(--neon-purple)] opacity-20" />

          {steps.map((step, index) => (
            <FadeInView
              key={step.number}
              delay={index * 100}
              duration={500}
              className="relative"
            >
              <Card glass hover className="relative z-10 h-full">
                <CardHeader className="text-center">
                  {/* Step Icon */}
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-[var(--neon-cyan)] to-[var(--neon-purple)] flex items-center justify-center text-3xl">
                    {step.icon}
                  </div>

                  {/* Step Number */}
                  <div className="text-sm text-[var(--neon-cyan)] font-mono mb-2">
                    {step.number}
                  </div>

                  {/* Step Title */}
                  <CardTitle className="text-xl mb-2">{step.title}</CardTitle>

                  {/* Step Description */}
                  <CardDescription>{step.description}</CardDescription>
                </CardHeader>
              </Card>

              {/* Arrow indicator (desktop only, except last item) — CSS animation */}
              {index < steps.length - 1 && (
                <div className="hidden md:block absolute top-1/2 -right-4 z-20 animate-arrow-bounce">
                  <ArrowRight className="w-6 h-6 text-[var(--neon-cyan)]" />
                </div>
              )}
            </FadeInView>
          ))}
        </div>

        {/* CTA */}
        <FadeInView delay={600} direction="none">
          <div className="text-center mt-16">
            <p className="text-gray-400 mb-4">
              {t('workflow.cta')}
            </p>
          </div>
        </FadeInView>
      </Container>
    </section>
  );
}
