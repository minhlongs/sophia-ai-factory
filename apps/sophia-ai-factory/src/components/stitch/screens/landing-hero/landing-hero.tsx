'use client';

import React, { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Link } from '@/navigation';
import { MarketingNav, MarketingFooter } from '@/components/stitch/layouts';
import {
  Sparkles,
  ArrowRight,
  Play,
  CheckCircle2,
  Cpu,
  Video,
  Send,
  Coins,
  ChevronDown,
  Star,
  Zap,
  TrendingUp,
  Layers,
  ShieldCheck,
} from 'lucide-react';
import { cn } from '@/seed/utils/cn';

const AVATARS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=120&auto=format&fit=crop&q=80',
];

export default function LandingHero() {
  const t = useTranslations('stitch.landing');
  const tLanding = useTranslations('landing');
  const locale = useLocale();
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const toggleFaq = (idx: number) => {
    setOpenFaq((prev) => (prev === idx ? null : idx));
  };

  const faqList = [
    {
      q: tLanding('faq.items.quality.question'),
      a: tLanding('faq.items.quality.answer'),
    },
    {
      q: tLanding('faq.items.copyright.question'),
      a: tLanding('faq.items.copyright.answer'),
    },
    {
      q: tLanding('faq.items.time.question'),
      a: tLanding('faq.items.time.answer'),
    },
    {
      q: tLanding('faq.items.support.question'),
      a: tLanding('faq.items.support.answer'),
    },
  ];

  return (
    <div className="min-h-screen bg-[#08090D] text-slate-100 selection:bg-indigo-500/30 selection:text-indigo-200">
      {/* Universal Marketing Navigation */}
      <MarketingNav />

      {/* ════ HERO SECTION ══════════════════════════════════════════════════ */}
      <main className="relative pt-32 pb-20 md:pt-44 md:pb-32 overflow-hidden">
        {/* Ambient Multi-Layer Radial Glow */}
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] pointer-events-none -z-10"
          aria-hidden="true"
        >
          <div className="absolute inset-0 bg-gradient-to-b from-indigo-600/20 via-purple-600/10 to-transparent blur-[140px] rounded-full" />
          <div className="absolute top-1/4 left-1/4 w-[400px] h-[300px] bg-amber-500/10 blur-[120px] rounded-full" />
        </div>

        {/* Hero Content Container */}
        <section className="max-w-7xl mx-auto px-6 flex flex-col items-center text-center">
          {/* Pulsing Announcement Badge */}
          <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/25 mb-8 shadow-inner hover:border-indigo-500/40 transition-colors">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500" />
            </span>
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-300">
              {t('badge')}
            </span>
          </div>

          {/* Primary Headline */}
          <h1 className="text-4xl sm:text-6xl md:text-7xl font-black leading-[1.08] tracking-tight max-w-5xl mb-6 text-white font-display">
            {t('headline')}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-amber-300">
              {t('headlineHighlight')}
            </span>
          </h1>

          {/* Subheading */}
          <p className="text-lg sm:text-xl text-slate-300 max-w-3xl mb-10 leading-relaxed font-normal">
            {t('subheading')}
          </p>

          {/* Action CTAs */}
          <div className="flex flex-col sm:flex-row items-center gap-4 mb-16 w-full sm:w-auto">
            <Link
              href="/register"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-8 py-4 rounded-xl text-base font-bold text-white bg-gradient-to-r from-indigo-600 via-indigo-500 to-violet-600 hover:from-indigo-500 hover:to-violet-500 shadow-xl shadow-indigo-500/30 hover:shadow-indigo-500/45 border border-indigo-400/30 transition-all active:scale-[0.98] group"
            >
              <span>{t('cta.startFree')}</span>
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>

            <Link
              href="/features"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-8 py-4 rounded-xl text-base font-bold text-slate-200 bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 hover:border-white/20 transition-all backdrop-blur-md"
            >
              <Play className="w-4 h-4 text-indigo-400 fill-indigo-400" />
              <span>{t('cta.watchDemo')}</span>
            </Link>
          </div>

          {/* Social Proof Bar */}
          <div className="flex flex-wrap items-center justify-center gap-6 py-3.5 px-6 rounded-2xl bg-[#11131E]/80 border border-white/[0.08] backdrop-blur-xl mb-20 shadow-2xl">
            {/* Avatar Stack */}
            <div className="flex -space-x-2.5 items-center">
              {AVATARS.map((src, i) => (
                <div
                  key={i}
                  className="w-8 h-8 rounded-full border-2 border-[#11131E] overflow-hidden bg-slate-800"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    className="w-full h-full object-cover"
                    src={src}
                    alt={`Creator ${i + 1}`}
                  />
                </div>
              ))}
              <div className="w-8 h-8 rounded-full border-2 border-[#11131E] flex items-center justify-center bg-indigo-600 text-white text-[11px] font-bold">
                +10k
              </div>
            </div>

            {/* Divider */}
            <div className="hidden sm:block h-5 w-[1px] bg-white/10" />

            {/* Rating Stars */}
            <div className="flex items-center gap-1.5">
              <div className="flex text-amber-400">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-3.5 h-3.5 fill-amber-400" />
                ))}
              </div>
              <span className="text-xs font-bold text-white">4.9/5</span>
            </div>

            {/* Divider */}
            <div className="hidden sm:block h-5 w-[1px] bg-white/10" />

            {/* Label */}
            <p className="text-xs font-semibold text-slate-300">
              <span className="text-white font-bold">{t('trustBar.creators')}</span> · {t('trustBar.videos')}
            </p>
          </div>

          {/* ════ AI FACTORY PIPELINE SHOWCASE MOCKUP ═══════════════════════ */}
          <div className="w-full max-w-5xl rounded-2xl border border-white/10 bg-[#0E101A]/90 p-4 sm:p-7 shadow-2xl shadow-indigo-950/40 backdrop-blur-2xl text-left relative group">
            {/* Window controls & live status */}
            <div className="flex items-center justify-between pb-5 border-b border-white/[0.08] mb-6">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-rose-500/80" />
                <span className="w-3 h-3 rounded-full bg-amber-500/80" />
                <span className="w-3 h-3 rounded-full bg-emerald-500/80" />
                <span className="ml-3 text-xs font-mono text-slate-400 hidden sm:inline">
                  sophia-pipeline-cluster: edge-cf-1.19
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                <span className="text-xs font-semibold text-emerald-400 font-mono">
                  FLEET STATUS: AUTONOMOUS ACTIVE
                </span>
              </div>
            </div>

            {/* 3-Column Visual Pipeline */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              {/* Card 1: Input & Script */}
              <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06] space-y-3">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span className="flex items-center gap-1.5 font-bold text-slate-300">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                    1. Prompt & Script
                  </span>
                  <span className="text-emerald-400 font-mono text-[11px]">Done ✓</span>
                </div>
                <div className="bg-[#08090D] p-3 rounded-lg border border-white/[0.05] text-xs font-mono text-slate-300">
                  <p className="text-indigo-300 font-bold mb-1">&gt; Topic: AI Passive Income 2026</p>
                  <p className="text-slate-400 leading-relaxed">
                    Hook: &quot;Stop trading time for money. Here are 3 AI engines running 24/7...&quot;
                  </p>
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span>Target: YouTube Shorts / TikTok</span>
                  <span className="text-indigo-400 font-semibold">Bilingual VI+EN</span>
                </div>
              </div>

              {/* Card 2: AI Voice & Video Render */}
              <div className="p-4 rounded-xl bg-white/[0.03] border border-indigo-500/20 shadow-inner space-y-3 relative">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span className="flex items-center gap-1.5 font-bold text-white">
                    <Cpu className="w-3.5 h-3.5 text-purple-400" />
                    2. Neural Composition
                  </span>
                  <span className="text-amber-400 font-mono text-[11px] animate-pulse">Rendering...</span>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400">Voice Synthesis (ElevenLabs)</span>
                    <span className="text-emerald-400 font-bold">100%</span>
                  </div>
                  <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-gradient-to-r from-indigo-500 to-purple-500 h-full w-full rounded-full" />
                  </div>
                  <div className="flex justify-between text-xs pt-1">
                    <span className="text-slate-400">Dynamic Captions & Visuals</span>
                    <span className="text-indigo-300 font-bold">60fps 4K</span>
                  </div>
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                  <span>Engine: FFMPEG + GPU</span>
                  <span className="text-emerald-400 font-mono font-semibold">Latency: 38s</span>
                </div>
              </div>

              {/* Card 3: Multichannel & Revenue */}
              <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06] space-y-3">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span className="flex items-center gap-1.5 font-bold text-slate-300">
                    <TrendingUp className="w-3.5 h-3.5 text-amber-400" />
                    3. Auto-Distribution
                  </span>
                  <span className="text-emerald-400 font-mono text-[11px]">Live ⚡</span>
                </div>
                <div className="bg-[#08090D] p-3 rounded-lg border border-white/[0.05] space-y-1.5 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">YouTube API:</span>
                    <span className="text-emerald-400 font-semibold font-mono">PUBLISHED</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Affiliate Tag:</span>
                    <span className="text-amber-400 font-semibold font-mono">1,420 Clicks</span>
                  </div>
                  <div className="flex justify-between items-center pt-1 border-t border-white/[0.06]">
                    <span className="text-slate-300 font-semibold">Estimated Payout:</span>
                    <span className="text-emerald-400 font-bold font-mono">+$384.50 USDT</span>
                  </div>
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span>Payout Protocol: NOWPayments</span>
                  <span className="text-indigo-400 font-semibold">Zero-Mock</span>
                </div>
              </div>
            </div>

            {/* Bottom Pipeline Metrics Bar */}
            <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-white/[0.08] text-xs text-slate-400">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Zero Operator Setup • BYOK Sovereign Control</span>
              </div>
              <div className="flex items-center gap-4 font-mono">
                <span>Avg Generation: <strong className="text-white">42s</strong></span>
                <span>Success Rate: <strong className="text-emerald-400">99.8%</strong></span>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ════ 4-STEP AUTOMATED WORKFLOW ═════════════════════════════════════ */}
      <section className="py-24 border-t border-white/[0.08] bg-[#0A0C14] relative">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-xs font-bold uppercase tracking-widest text-indigo-400 mb-3">
              {locale === 'vi' ? 'QUY TRÌNH VẬN HÀNH' : 'WORKFLOW ENGINE'}
            </h2>
            <h3 className="text-3xl sm:text-4xl font-black text-white tracking-tight mb-4">
              {tLanding('workflow.title')}
            </h3>
            <p className="text-slate-400 text-base">
              {tLanding('workflow.subtitle')}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                step: '01',
                icon: Layers,
                title: tLanding('workflow.steps.select_niche.title'),
                desc: tLanding('workflow.steps.select_niche.description'),
              },
              {
                step: '02',
                icon: Cpu,
                title: tLanding('workflow.steps.ai_generate.title'),
                desc: tLanding('workflow.steps.ai_generate.description'),
              },
              {
                step: '03',
                icon: Video,
                title: tLanding('workflow.steps.publish.title'),
                desc: tLanding('workflow.steps.publish.description'),
              },
              {
                step: '04',
                icon: Coins,
                title: tLanding('workflow.steps.profit.title'),
                desc: tLanding('workflow.steps.profit.description'),
              },
            ].map((item, idx) => {
              const Icon = item.icon;
              return (
                <div
                  key={idx}
                  className="p-6 rounded-2xl bg-[#11131E]/80 border border-white/[0.08] hover:border-indigo-500/40 hover:-translate-y-1 transition-all duration-300 shadow-xl group"
                >
                  <div className="flex items-center justify-between mb-5">
                    <span className="text-2xl font-black font-mono text-slate-600 group-hover:text-indigo-400 transition-colors">
                      {item.step}
                    </span>
                    <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 group-hover:scale-110 transition-transform">
                      <Icon className="w-5 h-5" />
                    </div>
                  </div>
                  <h4 className="text-lg font-bold text-white mb-2">{item.title}</h4>
                  <p className="text-sm text-slate-400 leading-relaxed">{item.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ════ CORE FEATURES GRID ═══════════════════════════════════════════ */}
      <section className="py-24 border-t border-white/[0.08] relative">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-xs font-bold uppercase tracking-widest text-indigo-400 mb-3">
              {locale === 'vi' ? 'TÍNH NĂNG ĐỘT PHÁ' : 'CORE CAPABILITIES'}
            </h2>
            <h3 className="text-3xl sm:text-4xl font-black text-white tracking-tight mb-4">
              {tLanding('features.title')}
            </h3>
            <p className="text-slate-400 text-base">
              {tLanding('features.subtitle')}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                icon: Video,
                title: t('features.scriptWriting.title'),
                desc: t('features.scriptWriting.description'),
                badge: 'AI Engine',
              },
              {
                icon: Send,
                title: t('features.multiChannel.title'),
                desc: t('features.multiChannel.description'),
                badge: 'Telegram Bot',
              },
              {
                icon: Coins,
                title: t('features.analytics.title'),
                desc: t('features.analytics.description'),
                badge: 'USDT Instant',
              },
            ].map((feat, idx) => {
              const Icon = feat.icon;
              return (
                <div
                  key={idx}
                  className="p-8 rounded-2xl bg-[#11131E]/80 border border-white/[0.08] hover:border-indigo-500/40 hover:-translate-y-1 transition-all duration-300 shadow-xl group flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-6">
                      <div className="w-12 h-12 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 group-hover:scale-110 transition-transform shadow-inner">
                        <Icon className="w-6 h-6" />
                      </div>
                      <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-white/[0.05] border border-white/[0.08] text-slate-300">
                        {feat.badge}
                      </span>
                    </div>
                    <h4 className="text-xl font-bold text-white mb-3">{feat.title}</h4>
                    <p className="text-sm text-slate-400 leading-relaxed">{feat.desc}</p>
                  </div>
                  <div className="mt-8 pt-4 border-t border-white/[0.06] flex items-center gap-2 text-xs font-semibold text-indigo-400 group-hover:text-indigo-300">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>{locale === 'vi' ? 'Sẵn sàng triển khai ngay' : 'Production Ready'}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ════ FAQ ACCORDION SECTION ═════════════════════════════════════════ */}
      <section className="py-24 border-t border-white/[0.08] bg-[#0A0C14]">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-xs font-bold uppercase tracking-widest text-indigo-400 mb-3">
              FAQ
            </h2>
            <h3 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
              {locale === 'vi' ? 'Câu Hỏi Thường Gặp' : 'Frequently Asked Questions'}
            </h3>
          </div>

          <div className="space-y-4">
            {faqList.map((item, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div
                  key={idx}
                  className="rounded-xl border border-white/[0.08] bg-[#11131E]/80 overflow-hidden transition-colors"
                >
                  <button
                    type="button"
                    onClick={() => toggleFaq(idx)}
                    className="w-full flex items-center justify-between p-5 text-left text-base font-bold text-white hover:text-indigo-300 transition-colors focus:outline-none"
                    aria-expanded={isOpen}
                  >
                    <span>{item.q}</span>
                    <ChevronDown
                      className={cn(
                        'w-5 h-5 text-slate-400 transition-transform duration-200',
                        isOpen && 'rotate-180 text-indigo-400'
                      )}
                    />
                  </button>
                  {isOpen && (
                    <div className="px-5 pb-5 text-sm text-slate-300 leading-relaxed border-t border-white/[0.05] pt-4">
                      {item.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ════ BOTTOM CALL TO ACTION BANNER ══════════════════════════════════ */}
      <section className="py-24 border-t border-white/[0.08] relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-t from-indigo-950/20 to-transparent pointer-events-none" />
        <div className="max-w-5xl mx-auto px-6 text-center relative z-10">
          <div className="p-8 sm:p-14 rounded-3xl bg-gradient-to-b from-[#141624] to-[#0D0F18] border border-indigo-500/30 shadow-2xl shadow-indigo-950/50">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 flex items-center justify-center text-indigo-300 mx-auto mb-6 shadow-inner">
              <Zap className="w-6 h-6" />
            </div>
            <h3 className="text-3xl sm:text-5xl font-black text-white tracking-tight mb-4">
              {locale === 'vi'
                ? 'Sẵn Sàng Xây Dựng Đế Chế Video AI?'
                : 'Ready to Build Your AI Video Empire?'}
            </h3>
            <p className="text-slate-300 text-base sm:text-lg max-w-2xl mx-auto mb-8 leading-relaxed">
              {locale === 'vi'
                ? 'Khởi tạo tài khoản trong 30 giây. Kết nối chìa khóa BYOK và bắt đầu tạo video không giới hạn ngay hôm nay.'
                : 'Create your account in 30 seconds. Connect your BYOK keys and start generating unlimited videos today.'}
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/register"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-9 py-4 rounded-xl text-base font-bold text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 shadow-xl shadow-indigo-500/30 border border-indigo-400/30 transition-all active:scale-[0.98]"
              >
                <span>{t('cta.startFree')}</span>
                <ArrowRight className="w-5 h-5" />
              </Link>
              <Link
                href="/pricing"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl text-base font-bold text-slate-300 hover:text-white bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 transition-all"
              >
                <span>{locale === 'vi' ? 'Xem Bảng Giá' : 'View Pricing'}</span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Universal Marketing Footer */}
      <MarketingFooter />
    </div>
  );
}
