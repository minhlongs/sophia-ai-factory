'use client';

import React from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useRouter, usePathname, Link } from '@/navigation';
import { Play, Sparkles, Share2, BarChart3, Star, Github } from 'lucide-react';
import { ScrollReveal } from '@/seed/components/ui/scroll-reveal';

interface Feature {
  key: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
}

const FEATURES: Feature[] = [
  { key: 'scriptWriting', icon: Sparkles },
  { key: 'multiChannel', icon: Share2 },
  { key: 'analytics', icon: BarChart3 },
];

const CREATOR_AVATARS = [
  'https://lh3.googleusercontent.com/aida-public/AB6AXuAfR0bknCkNIcP-Q_7hz6rAR72MpZ5rSptSsQArYIN9gjf7h4LZeK-b3w13kIH-09iQ-X0YDJLsUzyA1O2McDI0wAf2fawRoCadpH5XZHF7sz8e6nTkGl8oD8yUeekTuWjCJD_36G6U2vZRSyvBHEW8d1mWAAo_7TLHnpi1tweUa36a_Nke4PK9Le1ecVr7fVKFbnScLKHj9YRjNwciYPYY2MlT-ZThm_Nyxv1iISsJKAHhri1wQxbZ81k0j1xCs6BL2SQ7toUCINk',
  'https://lh3.googleusercontent.com/aida-public/AB6AXuDL8_7LlH2v_smJRWxa1eamUmFBwr6cSb4FlhdmM4FBnUJb0ygXZCWQaKpLb-L7qNMjc96XTl2_AG9_i8IJknagVZE9B2nPF_4T68HSm-Cp8xxz6pizXd1NdbGWbQon0i0cFWYx5T7pmLxotJkh6F2jLmkrhUIe7oUq4tAd4Al8m681lgMwNfjDj_lewTvvZofgwwiD00TR99y1K9QFZXZAQTy2nFvJ7jH7cMS5NEDCd0fuqI6QlVfBz0XDx4_qGwAty0vmneQHeaA',
  'https://lh3.googleusercontent.com/aida-public/AB6AXuAzASEzcoy22zcI1jAiCvG7Czgaz66KtXrRo09El0zvX9gc8ik9rL8q5Rqx0EZZwI_fm_32H5cE7o57qdt-jx4j1pKdVIcIcfwGv54jb9VNrpd282lxfhKUOEje8sXO1nLNGmzo0NUSTDb_5ZRmcGIgBndrWzr265fTlwHeUXsdiraGvgP6fkl7fXPYyXFbTSDvP36DUHyrCFE4_TxqAYvUHf6eY88t5Vrn4NoUHOaM6SklugRIFLULx6xzMKwNtoaoJeupOkm4hGA',
];

export default function LandingHero() {
  const t = useTranslations('stitch.landing');
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  const switchLocale = () => {
    const newLocale = locale === 'en' ? 'vi' : 'en';
    router.replace(pathname, { locale: newLocale });
  };

  return (
    <>
      {/* Fixed Top Navigation — Stitch design */}
      <nav className="fixed top-0 w-full z-50 bg-background/80 backdrop-blur-md border-b border-border/30 shadow-sm">
        <div className="flex justify-between items-center max-w-7xl mx-auto px-6 py-4">
          {/* Brand Logo */}
          <Link href="/" className="flex items-center gap-2">
            <span className="text-xl font-bold tracking-tight text-white">
              <span className="text-primary">Sophia</span> AI
            </span>
          </Link>
          {/* Nav Links */}
          <div className="hidden md:flex items-center gap-8 text-sm">
            <Link href="/features" className="text-muted-foreground hover:text-primary transition-colors">{t('features')}</Link>
            <Link href="/pricing" className="text-muted-foreground hover:text-primary transition-colors">{t('pricing')}</Link>
            <Link href="/guide" className="text-muted-foreground hover:text-primary transition-colors">{t('guide')}</Link>
            <Link href="/affiliates" className="text-muted-foreground hover:text-primary transition-colors">{t('affiliates')}</Link>
          </div>
          {/* Right side */}
          <div className="flex items-center gap-3">
            <button onClick={switchLocale} className="text-sm text-muted-foreground hover:text-primary transition-colors px-2 py-1 rounded" aria-label="Switch language">
              {locale === 'en' ? 'VI' : 'EN'}
            </button>
            <Link href="/login" className="px-5 py-2 rounded-lg text-muted-foreground hover:text-primary transition-all text-sm">
              {t('logIn')}
            </Link>
            <Link href="/auth/signup" className="px-6 py-2.5 rounded-lg bg-primary text-white font-medium hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 text-sm">
              {t('getStarted')}
            </Link>
          </div>
        </div>
      </nav>
      <main
        className="relative min-h-screen pt-24 flex flex-col items-center justify-center overflow-hidden"
        style={{
          background:
            'radial-gradient(circle at 50% -20%, hsl(var(--primary) / 0.15) 0%, rgba(14, 14, 18, 0) 60%)',
        }}
      >
        {/* Background decoration */}
        <div
          className="absolute top-1/4 -left-20 w-96 h-96 bg-primary/10 rounded-full blur-[120px] pointer-events-none"
          aria-hidden="true"
        />
        <div
          className="absolute bottom-1/4 -right-20 w-96 h-96 bg-primary/5 rounded-full blur-[120px] pointer-events-none"
          aria-hidden="true"
        />

        <section className="max-w-7xl mx-auto px-4 md:px-8 w-full flex flex-col items-center text-center space-y-8">
          {/* Badge */}
          <ScrollReveal>
            <div className="inline-flex items-center px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20">
              <span className="text-primary font-medium text-sm tracking-wide">
                {t('badge')}
              </span>
            </div>
          </ScrollReveal>

          {/* Headline */}
          <ScrollReveal delay={100}>
            <h1
              className="text-4xl md:text-5xl lg:text-[56px] font-bold leading-tight tracking-tight text-white max-w-4xl"
              style={{ textShadow: '0 0 30px hsl(var(--primary) / 0.3)' }}
            >
              {t('headline')}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-primary/60">
                {t('headlineHighlight')}
              </span>
            </h1>
          </ScrollReveal>

          {/* Subheading */}
          <ScrollReveal delay={200}>
            <p className="text-lg md:text-[20px] text-zinc-400 max-w-2xl leading-relaxed">
              {t('subheading')}
            </p>
          </ScrollReveal>

          {/* CTA Buttons */}
          <ScrollReveal delay={300}>
            <div className="flex flex-col sm:flex-row items-center gap-6 mt-4">
              <Link
                href="/auth/signup"
                className="h-12 px-10 rounded-xl bg-primary text-white font-semibold hover:bg-primary/90 transition-all active:scale-95 shadow-lg shadow-primary/30 flex items-center justify-center"
              >
                {t('cta.startFree')}
              </Link>
              <button
                type="button"
                className="group h-12 px-8 rounded-xl border border-outline-variant/50 text-white font-medium hover:bg-surface-container-highest transition-all flex items-center justify-center gap-2 active:scale-95"
                aria-label={t('cta.watchDemo')}
              >
                <Play
                  className="w-5 h-5 text-primary group-hover:scale-110 transition-transform"
                  aria-hidden="true"
                />
                {t('cta.watchDemo')}
              </button>
            </div>
          </ScrollReveal>

          {/* Trust Bar */}
          <ScrollReveal delay={400}>
            <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-4 pt-12 border-t border-outline-variant/20 w-full max-w-3xl mt-12">
              {/* Creators */}
              <div className="flex items-center gap-2">
                <div className="flex -space-x-3" role="list" aria-label={t('trustBar.label')}>
                  {CREATOR_AVATARS.map((src, i) => (
                    <div
                      key={i}
                      className="w-8 h-8 rounded-full border-2 border-background overflow-hidden"
                      role="listitem"
                    >
                      <img
                        className="w-full h-full object-cover"
                        alt={`Creator portrait ${i + 1}`}
                        src={src}
                      />
                    </div>
                  ))}
                  <div
                    className="w-8 h-8 rounded-full border-2 border-background bg-primary flex items-center justify-center text-white text-[10px] font-bold"
                    role="listitem"
                  >
                    +10k
                  </div>
                </div>
                <span className="text-sm font-medium text-on-surface-variant">
                  {t('trustBar.creators')}
                </span>
              </div>

              <div className="h-4 w-px bg-outline-variant/40 hidden md:block" aria-hidden="true" />

              <span className="text-sm font-medium text-on-surface-variant">
                {t('trustBar.videos')}
              </span>

              <div className="h-4 w-px bg-outline-variant/40 hidden md:block" aria-hidden="true" />

              {/* Rating */}
              <div className="flex items-center gap-1.5">
                <div className="flex text-yellow-500" aria-label="4.9 out of 5 stars">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <Star key={i} className="w-4 h-4" fill="currentColor" aria-hidden="true" />
                  ))}
                </div>
                <span className="text-sm font-medium text-on-surface-variant">4.9/5</span>
              </div>
            </div>
          </ScrollReveal>

          {/* Feature Cards */}
          <ScrollReveal
            delay={500}
            staggerDelay={150}
            className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-16 pb-20 w-full max-w-6xl text-left"
          >
            {FEATURES.map(({ key, icon: Icon }) => (
              <div
                key={key}
                className="group p-6 rounded-2xl border border-zinc-800/50 hover:border-primary/50 transition-all duration-500 text-left"
                style={{
                  background: 'rgba(37, 37, 46, 0.4)',
                  backdropFilter: 'blur(12px)',
                }}
              >
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-5 group-hover:bg-primary/20 transition-colors">
                  <Icon className="w-6 h-6 text-primary" aria-hidden="true" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">
                  {t(`features.${key}.title`)}
                </h3>
                <p className="text-sm text-on-surface-variant leading-relaxed">
                  {t(`features.${key}.description`)}
                </p>
              </div>
            ))}
          </ScrollReveal>
        </section>
      </main>

      {/* Footer */}
      <footer className="w-full py-12 bg-surface-container-low border-t border-outline-variant/20">
        <div className="max-w-7xl mx-auto px-4 md:px-8 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex flex-col items-center md:items-start gap-2">
            <span className="text-lg font-headline font-semibold text-on-surface">
              Sophia AI Factory
            </span>
            <p className="text-sm text-on-surface-variant">{t('footer.copyright')}</p>
          </div>
          <nav className="flex items-center gap-8" aria-label="Footer navigation">
            <Link
              href="/privacy"
              className="text-on-surface-variant hover:text-on-surface transition-colors text-sm"
            >
              {t('footer.privacy')}
            </Link>
            <Link
              href="/terms"
              className="text-on-surface-variant hover:text-on-surface transition-colors text-sm"
            >
              {t('footer.terms')}
            </Link>
            <Link
              href="/contact"
              className="text-on-surface-variant hover:text-on-surface transition-colors text-sm"
            >
              {t('footer.contact')}
            </Link>
          </nav>
          <div className="flex items-center gap-4">
            <a
              href="#"
              className="text-on-surface-variant hover:text-primary transition-colors"
              aria-label="Twitter"
              rel="noopener noreferrer"
            >
              <svg
                className="w-5 h-5"
                fill="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path d="M24 4.557c-.883.392-1.832.656-2.828.775 1.017-.609 1.798-1.574 2.165-2.724-.951.564-2.005.974-3.127 1.195-.897-.957-2.178-1.555-3.594-1.555-3.179 0-5.515 2.966-4.797 6.045-4.091-.205-7.719-2.165-10.148-5.144-1.29 2.213-.669 5.108 1.523 6.574-.806-.026-1.566-.247-2.229-.616-.054 2.281 1.581 4.415 3.949 4.89-.693.188-1.452.232-2.224.084.626 1.956 2.444 3.379 4.6 3.419-2.07 1.623-4.678 2.348-7.29 2.04 2.179 1.397 4.768 2.212 7.548 2.212 9.142 0 14.307-7.721 13.995-14.646.962-.695 1.797-1.562 2.457-2.549z" />
              </svg>
            </a>
            <a
              href="#"
              className="text-on-surface-variant hover:text-primary transition-colors"
              aria-label="GitHub"
              rel="noopener noreferrer"
            >
              <Github className="w-5 h-5" aria-hidden="true" />
            </a>
          </div>
        </div>
      </footer>
    </>
  );
}
