'use client';

import React from 'react';
import { Zap, Shield } from 'lucide-react';

export function SocialPublisherCockpitHeader() {
  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between p-4 rounded-xl bg-white/70 dark:bg-slate-900/70 backdrop-blur-md border border-slate-200/80 dark:border-slate-800/80 gap-3 shadow-sm">
      <div className="space-y-0.5">
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-[#4F46E5]/10 text-[#4F46E5] border border-[#4F46E5]/20 uppercase">
            Direct Publisher
          </span>
          <span className="flex items-center gap-1 text-[11px] text-[#10B981] font-semibold">
            <Zap className="w-3 h-3" /> Pacing Engine Active
          </span>
        </div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Xuất Bản Đa Kênh Trực Tiếp</h2>
        <p className="text-xs text-slate-500">
          Autonomous anti-detection distribution with organic jitter pacing.
        </p>
      </div>
      <div className="flex items-center gap-2 text-xs">
        <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 font-mono text-[11px]">
          OCC Lock: v1.4
        </span>
        <span className="px-2.5 py-1 rounded-lg bg-[#F59E0B]/10 text-[#F59E0B] border border-[#F59E0B]/30 font-semibold flex items-center gap-1">
          <Shield className="w-3 h-3" /> Anti-Detection
        </span>
      </div>
    </div>
  );
}
