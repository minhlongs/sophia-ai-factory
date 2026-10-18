'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/navigation';
import { Sparkles, Cpu, Zap, ArrowUpRight } from 'lucide-react';

export function MarketingFooterLinkColumns() {
  const t = useTranslations('stitch.landing');
  const tNav = useTranslations('landing.nav');
  const tFooter = useTranslations('landing.footer');

  return (
    <>
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
    </>
  );
}
