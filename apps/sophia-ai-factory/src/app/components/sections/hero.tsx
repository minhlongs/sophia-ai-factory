"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { FadeInView } from "@/components/ui/fade-in-view";
import Link from "next/link";

export function Hero() {
  const t = useTranslations('landing');
  return (
    <section className="relative min-h-screen flex items-center overflow-hidden pt-16">
      {/* Background Effects */}
      <div className="absolute inset-0 -z-10">
        {/* Radial gradient glow */}
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-[var(--neon-cyan)] opacity-20 blur-[120px] rounded-full" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-[var(--neon-purple)] opacity-20 blur-[120px] rounded-full" />

        {/* Grid pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:100px_100px]" />
      </div>

      <Container size="lg">
        <div className="max-w-4xl mx-auto text-center">
          {/* Main Headline */}
          <FadeInView duration={600}>
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold mb-6 leading-tight">
              <span className="bg-gradient-to-r from-[var(--neon-cyan)] via-white to-[var(--neon-purple)] bg-clip-text text-transparent animate-gradient">
                {t('hero.title_1')}
              </span>
              <br />
              <span className="text-white">
                {t('hero.title_2')}
              </span>
            </h1>
          </FadeInView>

          {/* Subtitle */}
          <FadeInView delay={200} duration={600}>
            <p className="text-lg md:text-2xl text-muted-foreground mb-12 max-w-2xl mx-auto px-4">
              {t('hero.subtitle')}
            </p>
          </FadeInView>

          {/* CTA Buttons */}
          <FadeInView delay={400} duration={600}>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center px-4">
              <Link href="/dashboard">
                <Button variant="glow" size="lg" className="w-full sm:w-auto min-w-[200px]">
                  {t('hero.cta_start')}
                </Button>
              </Link>
              <Button
                variant="secondary"
                size="lg"
                className="w-full sm:w-auto min-w-[200px]"
                onClick={(e) => {
                  e.preventDefault();
                  document.getElementById("features")?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
              >
                {t('hero.cta_demo')}
              </Button>
            </div>
          </FadeInView>

          {/* Stats */}
          <FadeInView delay={600} duration={600}>
            <dl className="mt-20 grid grid-cols-1 sm:grid-cols-3 gap-8 max-w-2xl mx-auto px-4" aria-label="Platform Statistics">
              <div className="text-center">
                <dt className="sr-only">Number of AI tools available</dt>
                <dd className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-[var(--neon-cyan)] to-[var(--neon-purple)] bg-clip-text text-transparent">
                  50+
                </dd>
                <dt className="text-sm text-muted-foreground mt-2">{t('hero.stats.tools')}</dt>
              </div>
              <div className="text-center">
                <dt className="sr-only">Videos generated</dt>
                <dd className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-[var(--neon-cyan)] to-[var(--neon-purple)] bg-clip-text text-transparent">
                  10K+
                </dd>
                <dt className="text-sm text-muted-foreground mt-2">{t('hero.stats.videos')}</dt>
              </div>
              <div className="text-center">
                <dt className="sr-only">Automation availability</dt>
                <dd className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-[var(--neon-cyan)] to-[var(--neon-purple)] bg-clip-text text-transparent">
                  24/7
                </dd>
                <dt className="text-sm text-muted-foreground mt-2">{t('hero.stats.automation')}</dt>
              </div>
            </dl>
          </FadeInView>
        </div>
      </Container>

      {/* Scroll Indicator — CSS animation instead of framer-motion */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce-slow" aria-hidden="true">
        <div className="w-6 h-10 border-2 border-primary/20 rounded-full flex items-start justify-center p-2">
          <div className="w-1 h-3 bg-primary/40 rounded-full" />
        </div>
      </div>
    </section>
  );
}
