'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/navigation';
import { Sparkles, Shield, Cpu, Zap, ArrowUpRight } from 'lucide-react';

export function MarketingFooter() {
  const t = useTranslations('stitch.landing');
  const tNav = useTranslations('landing.nav');
  const tFooter = useTranslations('landing.footer');

  return (
    <footer className="bg-card dark:bg-[#090A10] border-t border-border dark:border-white/[0.08] relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-6 py-16 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-12 mb-16">
          {/* Brand & Description (2 cols) */}
          <div className="md:col-span-2 space-y-4">
            <Link href="/" className="flex items-center gap-3 group focus:outline-none">
              <div className="w-9 h-9 rounded-xl bg-primary text-primary-foreground border border-primary/25 flex items-center justify-center shadow-sm">
                <Sparkles className="w-4 h-4" />
              </div>
              <span className="text-xl font-black tracking-tight text-foreground dark:text-white">
                Sophia <span className="text-primary font-semibold">AI Factory</span>
              </span>
            </Link>
            <p className="text-muted-foreground text-sm leading-relaxed max-w-sm">
              {tFooter('brand_description')}
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs font-mono font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse" />
                Cloudflare Workers v1.19
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-mono font-semibold">
                <Shield className="w-3 h-3 text-primary" />
                BYOK Architecture
              </span>
            </div>
          </div>

          {/* Product Links */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-foreground dark:text-slate-300">
              {tFooter('product')}
            </h4>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link href="/features" className="text-muted-foreground hover:text-foreground dark:hover:text-white transition-colors">
                  {tNav('features')}
                </Link>
              </li>
              <li>
                <Link href="/pricing" className="text-muted-foreground hover:text-foreground dark:hover:text-white transition-colors">
                  {tNav('pricing')}
                </Link>
              </li>
              <li>
                <Link href="/guide" className="text-muted-foreground hover:text-foreground dark:hover:text-white transition-colors">
                  {tNav('guide')}
                </Link>
              </li>
              <li>
                <Link href="/affiliates" className="text-muted-foreground hover:text-foreground dark:hover:text-white transition-colors">
                  {tNav('affiliates')}
                </Link>
              </li>
            </ul>
          </div>

          {/* Enterprise & Infrastructure */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-foreground dark:text-slate-300">
              {tFooter('engine')}
            </h4>
            <ul className="space-y-2.5 text-sm">
              <li className="flex items-center gap-1.5 text-muted-foreground">
                <Cpu className="w-3.5 h-3.5 text-primary" />
                <span>OpenNext Edge</span>
              </li>
              <li className="flex items-center gap-1.5 text-muted-foreground">
                <Zap className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                <span>NOWPayments USDT</span>
              </li>
              <li className="flex items-center gap-1.5 text-muted-foreground">
                <Sparkles className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                <span>ElevenLabs & D-ID</span>
              </li>
              <li>
                <Link href="/setup" className="text-primary hover:text-primary/80 transition-colors inline-flex items-center gap-1 font-medium">
                  <span>Setup Wizard</span>
                  <ArrowUpRight className="w-3 h-3" />
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal & Compliance */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-foreground dark:text-slate-300">
              {tFooter('legal')}
            </h4>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link href="/privacy" className="text-muted-foreground hover:text-foreground dark:hover:text-white transition-colors">
                  {t('footer.privacy')}
                </Link>
              </li>
              <li>
                <Link href="/terms" className="text-muted-foreground hover:text-foreground dark:hover:text-white transition-colors">
                  {t('footer.terms')}
                </Link>
              </li>
              <li>
                <Link href="/contact" className="text-muted-foreground hover:text-foreground dark:hover:text-white transition-colors">
                  {t('footer.contact')}
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 border-t border-border dark:border-white/[0.08] flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
          <p>{t('footer.copyright')}</p>
          <div className="flex items-center gap-6 font-mono">
            <span>Security Audited</span>
            <span>•</span>
            <span>Strict Zero-Mock Production</span>
            <span>•</span>
            <span>CF-Direct Deploy Proof</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
