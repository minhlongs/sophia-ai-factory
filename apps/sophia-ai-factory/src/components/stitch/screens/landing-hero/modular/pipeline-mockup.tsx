import React from 'react';
import { Sparkles, Cpu, TrendingUp } from 'lucide-react';
import { PipelineMockupHeader } from './pipeline-mockup-header';
import { PipelineMockupFooter } from './pipeline-mockup-footer';

export function PipelineMockup() {
  return (
    <div className="studio-glass film-strip w-full max-w-5xl rounded-2xl border border-[#E2E8F0] dark:border-white/[0.08] bg-white dark:bg-[#11131F] p-4 sm:p-7 shadow-xl dark:shadow-2xl text-left relative group">
      <span className="sr-only camera-rec" aria-hidden="true" />
      <PipelineMockupHeader />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="p-4 rounded-xl bg-[#F8F9FC] dark:bg-[#090A10]/60 border border-[#E2E8F0] dark:border-white/[0.08] space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1.5 font-bold text-[#0B0F19] dark:text-slate-200">
              <Sparkles className="w-3.5 h-3.5 text-[#4338CA] dark:text-[#6366F1]" />
              1. Dual-Niche & Offer
            </span>
            <span className="text-emerald-600 dark:text-emerald-400 font-mono text-[11px] font-semibold">Verified ✓</span>
          </div>
          <div className="bg-white dark:bg-[#090A10] p-3 rounded-lg border border-[#E2E8F0] dark:border-white/[0.06] text-xs font-mono text-slate-700 dark:text-slate-300">
            <p className="text-[#4338CA] dark:text-indigo-300 font-bold mb-1">&gt; Niche: CEX &amp; Global SaaS</p>
            <p className="text-slate-500 dark:text-slate-400 leading-relaxed">
              &quot;Evidence-backed product comparison &amp; fee rebate guide (Non-Custodial)...&quot;
            </p>
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
            <span>Programs: Binance / PartnerStack</span>
            <span className="text-[#4338CA] dark:text-indigo-400 font-semibold font-mono">Bilingual VI+EN</span>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[#F8F9FC] dark:bg-[#090A10]/60 border border-[#4338CA]/30 dark:border-[#6366F1]/30 shadow-inner space-y-3 relative">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1.5 font-bold text-[#0B0F19] dark:text-white">
              <Cpu className="w-3.5 h-3.5 text-[#D97706] dark:text-[#F59E0B]" />
              2. CEO Approval &amp; Render
            </span>
            <span className="text-[#D97706] dark:text-[#F59E0B] font-mono text-[11px] font-semibold animate-pulse">SHA-256 Locked</span>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-slate-600 dark:text-slate-400">CEO Payload Digest</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-bold font-mono">APPROVED</span>
            </div>
            <div className="w-full bg-slate-200 dark:bg-white/10 h-1.5 rounded-full overflow-hidden">
              <div className="bg-gradient-to-r from-[#4338CA] to-[#D97706] dark:from-[#6366F1] dark:to-[#F59E0B] h-full w-full rounded-full" />
            </div>
            <div className="flex justify-between text-xs pt-1">
              <span className="text-slate-600 dark:text-slate-400">Compliance (FTC / MiCA / NĐ52)</span>
              <span className="text-[#4338CA] dark:text-indigo-300 font-bold font-mono">PASS 100%</span>
            </div>
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-1">
            <span>Budget Cap: $2.50 / Video</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-mono font-semibold">Kill-Switch: Armed</span>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[#F8F9FC] dark:bg-[#090A10]/60 border border-[#E2E8F0] dark:border-white/[0.08] space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1.5 font-bold text-[#0B0F19] dark:text-slate-200">
              <TrendingUp className="w-3.5 h-3.5 text-[#D97706] dark:text-[#F59E0B]" />
              3. Attribution &amp; Ledger
            </span>
            <span className="text-emerald-600 dark:text-emerald-400 font-mono text-[11px] font-semibold">Live ⚡</span>
          </div>
          <div className="bg-white dark:bg-[#090A10] p-3 rounded-lg border border-[#E2E8F0] dark:border-white/[0.06] space-y-1.5 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-slate-500 dark:text-slate-400">Controlled Publish:</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold font-mono">VERIFIED</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500 dark:text-slate-400">Postback S2S:</span>
              <span className="text-[#D97706] dark:text-[#F59E0B] font-semibold font-mono">PAID_RECEIPT</span>
            </div>
            <div className="flex justify-between items-center pt-1 border-t border-[#E2E8F0] dark:border-white/[0.06]">
              <span className="text-[#0B0F19] dark:text-slate-300 font-semibold">Domain B Net (0% Fee):</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-bold font-mono">+$1,248.50 USD</span>
            </div>
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
            <span>7-Level Evidence Chain</span>
            <span className="text-[#4338CA] dark:text-indigo-400 font-semibold font-mono">Zero-Mock</span>
          </div>
        </div>
      </div>

      <PipelineMockupFooter />
    </div>
  );
}
