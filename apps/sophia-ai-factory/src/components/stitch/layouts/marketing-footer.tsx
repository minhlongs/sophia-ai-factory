'use client';

import React from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Link } from '@/navigation';
import { Sparkles, Shield, Cpu, Zap, ArrowUpRight } from 'lucide-react';

export function MarketingFooter() {
  const t = useTranslations('stitch.landing');
  const tNav = useTranslations('landing.nav');
  const locale = useLocale();

  return (
    <footer className="bg-[#06070A] border-t border-white/[0.08] relative overflow-hidden">
      {/* Ambient background glow */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-[250px] bg-indigo-600/5 rounded-full blur-[140px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6 py-16 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-12 mb-16">
          {/* Brand & Description (2 cols) */}
          <div className="md:col-span-2 space-y-4">
            <Link href="/" className="flex items-center gap-3 group focus:outline-none">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-md shadow-indigo-500/20">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <span className="text-xl font-black tracking-tight text-white">
                Sophia <span className="text-indigo-400 font-semibold">AI Factory</span>
              </span>
            </Link>
            <p className="text-slate-400 text-sm leading-relaxed max-w-sm">
              {locale === 'vi'
                ? 'Nền tảng tự động hóa sản xuất video AI, kết nối mạng lưới affiliate toàn cầu và vận hành đa kênh thông qua Telegram & Webhooks.'
                : 'Autonomous AI video production platform, global affiliate revenue aggregation, and multichannel distribution via Telegram & Webhooks.'}
            </p>
            <div className="flex items-center gap-3 pt-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Cloudflare Workers v1.19
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-semibold">
                <Shield className="w-3 h-3 text-indigo-400" />
                BYOK Architecture
              </span>
            </div>
          </div>

          {/* Product Links */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              {locale === 'vi' ? 'Sản Phẩm' : 'Product'}
            </h4>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link href="/features" className="text-slate-400 hover:text-white transition-colors">
                  {tNav('features')}
                </Link>
              </li>
              <li>
                <Link href="/pricing" className="text-slate-400 hover:text-white transition-colors">
                  {tNav('pricing')}
                </Link>
              </li>
              <li>
                <Link href="/guide" className="text-slate-400 hover:text-white transition-colors">
                  {tNav('guide')}
                </Link>
              </li>
              <li>
                <Link href="/affiliates" className="text-slate-400 hover:text-white transition-colors">
                  {tNav('affiliates')}
                </Link>
              </li>
            </ul>
          </div>

          {/* Enterprise & Infrastructure */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              {locale === 'vi' ? 'Hạ Tầng' : 'Engine'}
            </h4>
            <ul className="space-y-2.5 text-sm">
              <li className="flex items-center gap-1.5 text-slate-400">
                <Cpu className="w-3.5 h-3.5 text-indigo-400" />
                <span>OpenNext Edge</span>
              </li>
              <li className="flex items-center gap-1.5 text-slate-400">
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                <span>NOWPayments USDT</span>
              </li>
              <li className="flex items-center gap-1.5 text-slate-400">
                <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                <span>ElevenLabs & D-ID</span>
              </li>
              <li>
                <Link href="/setup" className="text-indigo-400 hover:text-indigo-300 transition-colors inline-flex items-center gap-1">
                  <span>Setup Wizard</span>
                  <ArrowUpRight className="w-3 h-3" />
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal & Compliance */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              {locale === 'vi' ? 'Pháp Lý' : 'Legal'}
            </h4>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link href="/privacy" className="text-slate-400 hover:text-white transition-colors">
                  {t('footer.privacy')}
                </Link>
              </li>
              <li>
                <Link href="/terms" className="text-slate-400 hover:text-white transition-colors">
                  {t('footer.terms')}
                </Link>
              </li>
              <li>
                <Link href="/contact" className="text-slate-400 hover:text-white transition-colors">
                  {t('footer.contact')}
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 border-t border-white/[0.06] flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <p>{t('footer.copyright')}</p>
          <div className="flex items-center gap-6">
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
