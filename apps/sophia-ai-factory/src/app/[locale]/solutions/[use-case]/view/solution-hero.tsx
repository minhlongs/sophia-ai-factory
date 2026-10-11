import React from 'react';
import { Sparkles, ArrowRight, Send, CheckCircle2 } from 'lucide-react';
import type { SolutionHeroProps } from './types';

export function SolutionHero({ industry, locale, checkoutUrl, telegramUrl }: SolutionHeroProps) {
  const isVi = locale === 'vi';

  return (
    <section className="relative overflow-hidden pt-16 pb-20 border-b border-zinc-800/80">
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-emerald-500/10 blur-[130px] rounded-full pointer-events-none" />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 relative z-10 text-center">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-zinc-900 border border-zinc-800 text-xs font-semibold text-emerald-400 mb-6 shadow-sm">
          <Sparkles className="w-3.5 h-3.5" />
          <span>
            {isVi ? `Giải Pháp Dành Riêng Cho: ${industry.nameVi}` : `Tailored for: ${industry.nameEn}`}
          </span>
        </div>

        <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-tight max-w-4xl mx-auto">
          {isVi ? industry.heroHeadlineVi : industry.heroHeadlineEn}
        </h1>

        <p className="mt-5 text-base sm:text-lg text-zinc-300 max-w-3xl mx-auto leading-relaxed">
          {isVi ? industry.heroSubheadlineVi : industry.heroSubheadlineEn}
        </p>

        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
          <a
            href={checkoutUrl}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-sm font-bold shadow-lg shadow-emerald-500/20 transition hover:scale-105"
          >
            <span>{isVi ? 'Đăng ký ngay (-$100 với SOLO100)' : 'Claim $100 OFF with SOLO100'}</span>
            <ArrowRight className="w-4 h-4" />
          </a>

          <a
            href={telegramUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-sm font-semibold border border-zinc-700 transition"
          >
            <Send className="w-4 h-4 text-sky-400" />
            <span>{isVi ? 'Xem demo trên Telegram' : 'Test Free Telegram Demo'}</span>
          </a>
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-6 text-xs text-zinc-400">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{isVi ? 'Xuất video 1080p sau 60s' : 'Sub-60s 1080p generation'}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{isVi ? 'Tự động đa kênh TikTok, YouTube, X' : 'TikTok, YouTube Shorts, X automated'}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{isVi ? 'Thanh toán USDT & VietQR' : 'USDT & VietQR supported'}</span>
          </div>
        </div>
      </div>
    </section>
  );
}
