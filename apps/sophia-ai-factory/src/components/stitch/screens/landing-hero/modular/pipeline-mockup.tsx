import React from 'react';
import { Sparkles, Cpu, TrendingUp, ShieldCheck } from 'lucide-react';

export function PipelineMockup() {
  return (
    <div className="w-full max-w-5xl rounded-2xl border border-white/10 bg-[#0E101A]/90 p-4 sm:p-7 shadow-2xl shadow-indigo-950/40 backdrop-blur-2xl text-left relative group">
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
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
  );
}
