import React from 'react';
import { ShieldCheck } from 'lucide-react';

export function PipelineMockupFooter() {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-[#E2E8F0] dark:border-white/[0.08] text-xs text-slate-500 dark:text-slate-400">
      <div className="flex items-center gap-2">
        <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
        <span className="font-medium text-[#0B0F19] dark:text-slate-300">
          You approve every campaign before it runs • Your own API keys • Your earnings stay yours
        </span>
      </div>
      <div className="flex items-center gap-4">
        <span>Dual-Niche: <strong className="text-[#0B0F19] dark:text-white">CEX + SaaS</strong></span>
      </div>
    </div>
  );
}
