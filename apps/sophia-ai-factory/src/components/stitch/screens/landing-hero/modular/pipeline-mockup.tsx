import React from 'react';
import { Sparkles, Cpu, TrendingUp, ShieldCheck } from 'lucide-react';

export function PipelineMockup() {
  return (
    <div className="studio-glass film-strip w-full max-w-5xl rounded-2xl border border-[#E2E8F0] dark:border-white/[0.08] bg-white dark:bg-[#11131F] p-4 sm:p-7 shadow-xl dark:shadow-2xl text-left relative group">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-5 border-b border-[#E2E8F0] dark:border-white/[0.08] mb-6">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-rose-500/80" />
          <span className="w-3 h-3 rounded-full bg-amber-500/80" />
          <span className="w-3 h-3 rounded-full bg-emerald-500/80" />
          <span className="ml-3 text-xs font-mono text-slate-500 dark:text-slate-400 hidden sm:inline">
            sophia-pipeline-cluster: edge-cf-1.19
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="camera-rec font-mono">LIVE DECK</span>
          <span className="h-3.5 w-[1px] bg-[#E2E8F0] dark:bg-white/10" aria-hidden="true" />
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 font-mono">
              FLEET STATUS: AUTONOMOUS ACTIVE
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="p-4 rounded-xl bg-[#F8F9FC] dark:bg-[#090A10]/60 border border-[#E2E8F0] dark:border-white/[0.08] space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1.5 font-bold text-[#0B0F19] dark:text-slate-200">
              <Sparkles className="w-3.5 h-3.5 text-[#4338CA] dark:text-[#6366F1]" />
              1. Prompt & Script
            </span>
            <span className="text-emerald-600 dark:text-emerald-400 font-mono text-[11px] font-semibold">Done ✓</span>
          </div>
          <div className="bg-white dark:bg-[#090A10] p-3 rounded-lg border border-[#E2E8F0] dark:border-white/[0.06] text-xs font-mono text-slate-700 dark:text-slate-300">
            <p className="text-[#4338CA] dark:text-indigo-300 font-bold mb-1">&gt; Topic: AI Passive Income 2026</p>
            <p className="text-slate-500 dark:text-slate-400 leading-relaxed">
              Hook: &quot;Stop trading time for money. Here are 3 AI engines running 24/7...&quot;
            </p>
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
            <span>Target: YouTube Shorts / TikTok</span>
            <span className="text-[#4338CA] dark:text-indigo-400 font-semibold font-mono">Bilingual VI+EN</span>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[#F8F9FC] dark:bg-[#090A10]/60 border border-[#4338CA]/30 dark:border-[#6366F1]/30 shadow-inner space-y-3 relative">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1.5 font-bold text-[#0B0F19] dark:text-white">
              <Cpu className="w-3.5 h-3.5 text-[#D97706] dark:text-[#F59E0B]" />
              2. Neural Composition
            </span>
            <span className="text-[#D97706] dark:text-[#F59E0B] font-mono text-[11px] font-semibold animate-pulse">Rendering...</span>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-slate-600 dark:text-slate-400">Voice Synthesis (ElevenLabs)</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-bold font-mono">100%</span>
            </div>
            <div className="w-full bg-slate-200 dark:bg-white/10 h-1.5 rounded-full overflow-hidden">
              <div className="bg-gradient-to-r from-[#4338CA] to-[#D97706] dark:from-[#6366F1] dark:to-[#F59E0B] h-full w-full rounded-full" />
            </div>
            <div className="flex justify-between text-xs pt-1">
              <span className="text-slate-600 dark:text-slate-400">Dynamic Captions & Visuals</span>
              <span className="text-[#4338CA] dark:text-indigo-300 font-bold font-mono">60fps 4K</span>
            </div>
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-1">
            <span>Engine: FFMPEG + GPU</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-mono font-semibold">Latency: 38s</span>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[#F8F9FC] dark:bg-[#090A10]/60 border border-[#E2E8F0] dark:border-white/[0.08] space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1.5 font-bold text-[#0B0F19] dark:text-slate-200">
              <TrendingUp className="w-3.5 h-3.5 text-[#D97706] dark:text-[#F59E0B]" />
              3. Auto-Distribution
            </span>
            <span className="text-emerald-600 dark:text-emerald-400 font-mono text-[11px] font-semibold">Live ⚡</span>
          </div>
          <div className="bg-white dark:bg-[#090A10] p-3 rounded-lg border border-[#E2E8F0] dark:border-white/[0.06] space-y-1.5 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-slate-500 dark:text-slate-400">YouTube API:</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold font-mono">PUBLISHED</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500 dark:text-slate-400">Affiliate Tag:</span>
              <span className="text-[#D97706] dark:text-[#F59E0B] font-semibold font-mono">1,420 Clicks</span>
            </div>
            <div className="flex justify-between items-center pt-1 border-t border-[#E2E8F0] dark:border-white/[0.06]">
              <span className="text-[#0B0F19] dark:text-slate-300 font-semibold">Estimated Payout:</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-bold font-mono">+$384.50 USDT</span>
            </div>
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
            <span>Payout Protocol: NOWPayments</span>
            <span className="text-[#4338CA] dark:text-indigo-400 font-semibold font-mono">Zero-Mock</span>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-[#E2E8F0] dark:border-white/[0.08] text-xs text-slate-500 dark:text-slate-400">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <span className="font-medium text-[#0B0F19] dark:text-slate-300">Zero Operator Setup • BYOK Sovereign Control</span>
        </div>
        <div className="flex items-center gap-4 font-mono">
          <span>Avg Generation: <strong className="text-[#0B0F19] dark:text-white">42s</strong></span>
          <span>Success Rate: <strong className="text-emerald-600 dark:text-emerald-400">99.8%</strong></span>
        </div>
      </div>
    </div>
  );
}
