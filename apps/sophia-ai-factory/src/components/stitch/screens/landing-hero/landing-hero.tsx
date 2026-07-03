'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { ArrowRight, Play, Sparkles, Share2, BarChart3 } from 'lucide-react';
import { Button } from '@/components/stitch';
import { ScrollReveal } from '@/seed/components/ui/scroll-reveal';
import { Link } from '@/navigation';

const NAV_ITEMS = ['features', 'pricing', 'blog', 'affiliates'] as const;

interface Feature {
  key: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
}

const FEATURES: Feature[] = [
  { key: 'scriptWriting', icon: Sparkles },
  { key: 'multiChannel', icon: Share2 },
  { key: 'analytics', icon: BarChart3 },
];

export default function LandingHero() {
  const t = useTranslations('stitch.landing');

  return (
    <>
      {/* ── Top Navigation Bar ──────────────────────────────────────────────── */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
        <nav
          className="flex justify-between items-center w-full px-4 md:px-8 py-4 max-w-7xl mx-auto"
          aria-label="Main navigation"
        >
          {/* Brand */}
          <Link
            href="/"
            className="text-2xl font-headline-xl font-bold text-primary tracking-tighter"
          >
            Sophia
          </Link>

          {/* Nav Links - Desktop */}
          <div className="hidden md:flex gap-8 items-center">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item}
                href={`#${item}`}
                className="text-muted-foreground hover:text-foreground transition-colors font-label-sm"
              >
                {t(`nav.${item}`)}
              </Link>
            ))}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-4 md:gap-6">
            <Link
              href="/auth/login"
              className="text-muted-foreground hover:text-foreground transition-colors font-label-sm"
            >
              {t('nav.signIn')}
            </Link>
            <Button size="md" href="/auth/register">
              {t('nav.startFree')}
            </Button>
          </div>
        </nav>
      </header>

      {/* ── Hero Section ───────────────────────────────────────────────────── */}
      <main className="relative pt-32 pb-24 overflow-hidden">
        {/* Background ambient glow */}
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full pointer-events-none -z-10"
          style={{
            background:
              'radial-gradient(ellipse at 50% 50%, hsla(var(--primary) / 0.1) 0%, transparent 70%)',
          }}
          aria-hidden="true"
        />

        <section className="max-w-7xl mx-auto px-4 md:px-8 flex flex-col items-center text-center">
          {/* Badge */}
          <ScrollReveal>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 mb-8">
              <span
                className="w-2 h-2 rounded-full bg-primary animate-pulse"
                aria-hidden="true"
              />
              <span className="text-xs font-bold uppercase tracking-widest text-primary">
                {t('badge')}
              </span>
            </div>
          </ScrollReveal>

          {/* Headline */}
          <ScrollReveal delay={100}>
            <h1 className="text-4xl md:text-5xl lg:text-[64px] font-headline-xl leading-[1.1] mb-6 tracking-tight max-w-[900px]">
              {t('headline')}{' '}
              <span className="text-primary italic">{t('headlineHighlight')}</span>
            </h1>
          </ScrollReveal>

          {/* Subheading */}
          <ScrollReveal delay={200}>
            <p className="text-lg md:text-xl text-muted-foreground max-w-[720px] mb-12 leading-relaxed">
              {t('subheading')}
            </p>
          </ScrollReveal>

          {/* CTA Buttons */}
          <ScrollReveal delay={300}>
            <div className="flex flex-col sm:flex-row gap-4 mb-16">
              <Button
                size="lg"
                href="/auth/register"
                iconRight={<ArrowRight className="w-5 h-5" />}
                className="hover:shadow-[0_0_20px_hsl(var(--primary)/0.4)]"
              >
                {t('cta.startFree')}
              </Button>
              <Button
                variant="outline"
                size="lg"
                iconLeft={<Play className="w-5 h-5" />}
              >
                {t('cta.watchDemo')}
              </Button>
            </div>
          </ScrollReveal>

          {/* Trust Bar */}
          <ScrollReveal delay={400}>
            <div className="flex flex-col items-center gap-4 mb-24 py-8 px-8 md:px-12 bg-background/60 backdrop-blur-lg border border-border rounded-2xl">
              <div className="flex -space-x-3" role="list" aria-label={t('trustBar.label')}>
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="w-10 h-10 rounded-full border-2 border-background overflow-hidden bg-gradient-to-br from-primary/30 to-accent/30"
                    role="listitem"
                    aria-hidden="true"
                  />
                ))}
                <div
                  className="w-10 h-10 rounded-full border-2 border-background flex items-center justify-center bg-primary text-primary-foreground text-xs font-bold"
                  role="listitem"
                >
                  +10k
                </div>
              </div>
              <p className="text-sm font-label-sm text-muted-foreground">
                <span className="text-foreground font-semibold">
                  {t('trustBar.creators')}
                </span>{' '}
                · {t('trustBar.videos')}
              </p>
            </div>
          </ScrollReveal>

          {/* Features Grid */}
          <ScrollReveal
            delay={500}
            staggerDelay={150}
            className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full text-left"
          >
            {FEATURES.map(({ key, icon: Icon }) => (
              <div
                key={key}
                className="bg-background/60 backdrop-blur-lg border border-border p-8 rounded-2xl hover:border-primary/40 transition-colors group"
              >
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-6 text-primary group-hover:scale-110 transition-transform">
                  <Icon className="w-6 h-6" aria-hidden="true" />
                </div>
                <h3 className="text-xl font-headline-md font-bold mb-3 text-foreground">
                  {t(`features.${key}.title`)}
                </h3>
                <p className="text-muted-foreground leading-relaxed font-body-md">
                  {t(`features.${key}.description`)}
                </p>
              </div>
            ))}
          </ScrollReveal>
        </section>
      </main>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <footer className="bg-card border-t border-border">
        <div className="flex flex-col md:flex-row justify-between items-center w-full px-4 md:px-8 py-12 max-w-7xl mx-auto">
          <div className="flex flex-col items-center md:items-start gap-2 mb-8 md:mb-0">
            <span className="text-xl font-headline-md font-bold text-foreground">
              Sophia
            </span>
            <p className="font-body-sm text-muted-foreground">
              {t('footer.copyright')}
            </p>
          </div>
          <nav className="flex gap-8" aria-label="Footer navigation">
            <Link
              href="/privacy"
              className="text-muted-foreground hover:text-primary transition-colors font-body-sm"
            >
              {t('footer.privacy')}
            </Link>
            <Link
              href="/terms"
              className="text-muted-foreground hover:text-primary transition-colors font-body-sm"
            >
              {t('footer.terms')}
            </Link>
            <Link
              href="/contact"
              className="text-muted-foreground hover:text-primary transition-colors font-body-sm"
            >
              {t('footer.contact')}
            </Link>
          </nav>
        </div>
      </footer>
    </>
  );
}
