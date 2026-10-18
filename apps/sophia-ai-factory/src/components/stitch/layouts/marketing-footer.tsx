'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/navigation';
import { Sparkles, Shield } from 'lucide-react';
import { MarketingFooterLinkColumns } from './marketing-footer-link-columns';

export { MarketingFooterLinkColumns };

export function MarketingFooter() {
  const t = useTranslations('stitch.landing');
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

          <MarketingFooterLinkColumns />
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
