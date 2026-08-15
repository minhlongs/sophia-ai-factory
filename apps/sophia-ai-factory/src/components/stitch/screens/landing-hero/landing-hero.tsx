'use client';

import React, { useEffect } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useRouter, usePathname, Link } from '@/navigation';

const AVATARS = [
  'https://lh3.googleusercontent.com/aida-public/AB6AXuCDAuW0W80fs5qron9rDz8zkcE9LOTwcztetaryA3IbBis6LIln71cvQwJB4J4M3EA44LkEbi055OZbWE9KhVFOgCs4TXRY9RD3J4K-Y2zQpJ8QcnNidE2zlSt1Ri3Ou4thLUm7j5D5dX-wPxLg1C12YDhU40YsE0KTbmXVZhUmDxy-g1VXpz71pQaBhD1p7GPasLqb1uNSb5O8xtyvi0uU1Miwr5RFLeDD43UF-floKvCvkv7d2Z2aT04qQKrZIqkWFCHGjlnJh-U',
  'https://lh3.googleusercontent.com/aida-public/AB6AXuC0fuou_NhWYX61uiQrYuhqG9FAY1WczVqOhncma8y2oWZrZb7MPm1cr_PWGaOftmwdiX39_g6bx8YbPyfNNpQ01h0b1rBNsI2t_U5AJ8IfEBixZe_7v3o-kTspGPTdDikfyFyaPDf8MClt_zQhGMM2vyixWr-Axidl6FPNlKO7G4CI-4ZFgJLz1oYnPSbCzfIIxF5vikED94a2uiZfR76R-SeZ0PFA55RjyXyrvTx5kbbEJ7lA4KSokyyo3DUolab1fjxaxZHvi8M',
  'https://lh3.googleusercontent.com/aida-public/AB6AXuAAGnFakmBi3mIFzAjqd0UdSOdm2eoo5LshfcllJb36IYWv-SR3jUz2CjXW6sBiAR3fB_kmmSqMfBHFW--7hbA6nqNRmVeRABgVkeJjqFLPoCemHbx-q6FyJ7dhpBQ1LQUbDlJzgAIAIxTpq0HRcUITxMsvNVlmlsUpibpAT7APtoa2k5O_6P0v1b2t8rK5qRk7HvkDEl7qXhA10nGJE3-hrHXLabtKeUA6YaQ0yqRqKYs4jFxPciCFmMsufI3QKj67OIq2YhepMJM',
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

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('opacity-100', 'translate-y-0');
            entry.target.classList.remove('opacity-0', 'translate-y-8');
          }
        });
      },
      { threshold: 0.1 }
    );
    document.querySelectorAll('.reveal-card').forEach((card) => observer.observe(card));
    return () => observer.disconnect();
  }, []);

  return (
    <>
      {/* Fixed Top Navigation */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-surface/80 backdrop-blur-md">
        <nav className="flex justify-between items-center w-full px-8 py-4 max-w-[1200px] mx-auto">
          <Link href="/" className="text-2xl font-black tracking-tighter text-primary">
            Sophia
          </Link>
          <div className="hidden md:flex gap-8 items-center">
            <Link href="/features" className="text-on-surface-variant hover:text-on-surface transition-colors font-medium text-sm">{t('nav.features')}</Link>
            <Link href="/pricing" className="text-on-surface-variant hover:text-on-surface transition-colors font-medium text-sm">{t('nav.pricing')}</Link>
            <Link href="/guide" className="text-on-surface-variant hover:text-on-surface transition-colors font-medium text-sm">{t('nav.guide')}</Link>
            <Link href="/affiliates" className="text-on-surface-variant hover:text-on-surface transition-colors font-medium text-sm">{t('nav.affiliates')}</Link>
          </div>
          <div className="flex items-center gap-6">
            <button onClick={switchLocale} className="text-on-surface-variant hover:text-on-surface transition-colors font-medium text-sm px-2 py-1 rounded" aria-label="Switch language">
              {locale === 'en' ? 'VI' : 'EN'}
            </button>
            <Link href="/login" className="text-on-surface-variant hover:text-on-surface transition-colors font-medium text-sm">{t('nav.login')}</Link>
            <Link href="/register" className="bg-primary text-primary-foreground font-bold px-5 py-2.5 rounded-lg text-sm hover:opacity-90 transition-all shadow-lg shadow-primary/20">
              {t('nav.getStarted')}
            </Link>
          </div>
        </nav>
      </header>

      {/* Hero */}
      <main className="relative pt-32 pb-24 overflow-hidden bg-[#0F0F11]">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full hero-gradient pointer-events-none -z-10" aria-hidden="true" />

        <section className="max-w-[1200px] mx-auto px-8 flex flex-col items-center text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/20 border border-primary/20 mb-8">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span className="text-xs font-bold uppercase tracking-widest text-primary">{t('badge')}</span>
          </div>

          {/* Headline */}
          <h1 className="text-5xl md:text-[64px] font-black leading-[1.1] mb-6 tracking-tight max-w-[900px] text-white">
            {t('headline')} <span className="text-primary italic">{t('headlineHighlight')}</span>
          </h1>

          {/* Subheading */}
          <p className="text-xl text-on-surface-variant max-w-[720px] mb-12 leading-relaxed">
            {t('subheading')}
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 mb-16">
            <Link
              href="/register"
              className="bg-primary text-primary-foreground px-8 py-4 rounded-xl font-bold text-lg hover:opacity-90 transition-all shadow-lg shadow-primary/30 flex items-center gap-2 group"
            >
              {t('cta.startFree')}
              <span className="inline-block group-hover:translate-x-1 transition-transform" aria-hidden="true">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </span>
            </Link>
            <button
              type="button"
              className="border border-outline-variant text-on-surface hover:bg-surface-variant px-8 py-4 rounded-xl font-bold text-lg transition-all flex items-center gap-2"
            >
              <span className="text-primary" aria-hidden="true">
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </span>
              {t('cta.watchDemo')}
            </button>
          </div>

          {/* Trust Bar */}
          <div className="flex flex-col items-center gap-4 mb-24 py-8 px-12 rounded-2xl bg-surface-container/60 backdrop-blur-md border border-outline-variant/40">
            <div className="flex -space-x-3">
              {AVATARS.map((src, i) => (
                <div key={i} className="w-10 h-10 rounded-full border-2 border-surface-container overflow-hidden bg-surface-bright">
                  {/* eslint-disable-next-line @next/next/no-img-element -- external avatar URLs */}
                  <img className="w-full h-full object-cover" src={src} alt={`Creator ${i + 1}`} />
                </div>
              ))}
              <div className="w-10 h-10 rounded-full border-2 border-surface-container flex items-center justify-center bg-primary text-primary-foreground text-xs font-bold">
                +10k
              </div>
            </div>
            <p className="text-sm font-semibold text-on-surface-variant">
              <span className="text-on-surface">{t('trustBar.creators')}</span> · {t('trustBar.videos')}
            </p>
          </div>

          {/* Features Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full text-left">
            {[
              { svg: 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z', title: t('features.scriptWriting.title'), desc: 'features.scriptWriting.description' },
              { svg: 'M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z', title: t('features.multiChannel.title'), desc: 'features.multiChannel.description' },
              { svg: 'M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z', title: t('features.analytics.title'), desc: 'features.analytics.description' },
            ].map((feat, i) => (
              <div
                key={i}
                className="reveal-card opacity-0 translate-y-8 transition-all duration-700 p-8 rounded-2xl bg-surface-container/60 backdrop-blur-md border border-outline-variant/40 hover:border-primary/40 transition-colors group"
              >
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-6 text-primary group-hover:scale-110 transition-transform">
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d={feat.svg} /></svg>
                </div>
                <h3 className="text-xl font-bold mb-3 text-on-surface">{feat.title}</h3>
                <p className="text-on-surface-variant leading-relaxed">{t(feat.desc)}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-surface-container-lowest border-t border-outline-variant">
        <div className="flex flex-col md:flex-row justify-between items-center w-full px-8 py-12 max-w-[1200px] mx-auto">
          <div className="flex flex-col items-center md:items-start gap-2 mb-8 md:mb-0">
            <span className="text-xl font-bold text-on-surface">{t('nav.brand') || 'Sophia'}</span>
            <p className="text-sm text-on-surface-variant">{t('footer.copyright')}</p>
          </div>
          <div className="flex gap-8">
            <Link href="/privacy" className="text-on-surface-variant hover:text-primary transition-colors text-sm">{t('footer.privacy')}</Link>
            <Link href="/terms" className="text-on-surface-variant hover:text-primary transition-colors text-sm">{t('footer.terms')}</Link>
            <Link href="/contact" className="text-on-surface-variant hover:text-primary transition-colors text-sm">{t('footer.contact')}</Link>
          </div>
        </div>
      </footer>

      <style jsx>{`
        .hero-gradient {
          background: radial-gradient(circle at 50% 50%, hsla(var(--primary) / 0.1) 0%, rgba(15, 15, 17, 0) 70%);
        }
        .reveal-card {
          transition: opacity 0.7s, transform 0.7s;
        }
      `}</style>
    </>
  );
}
