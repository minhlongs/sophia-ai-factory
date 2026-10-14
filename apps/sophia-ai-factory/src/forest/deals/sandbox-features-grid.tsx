/**
 * Sandbox demo feature highlights grid
 *
 * Layer: forest/deals (UI presentation)
 *
 * @module forest/deals/sandbox-features-grid
 */

import React from 'react';
import { ShieldCheck, Cpu, Clock } from 'lucide-react';

export function SandboxFeaturesGrid() {
  return (
    <div className="grid grid-cols-3 gap-3">
      <div className="p-3.5 rounded-lg bg-zinc-950 border border-zinc-800 space-y-1">
        <div className="flex items-center gap-1.5 text-xs text-zinc-400 font-medium">
          <Cpu className="w-4 h-4 text-emerald-400" /> Demo Quota
        </div>
        <div className="text-lg font-bold text-white">1,000 MCU</div>
        <div className="text-[11px] text-zinc-500">~10 demo videos</div>
      </div>

      <div className="p-3.5 rounded-lg bg-zinc-950 border border-zinc-800 space-y-1">
        <div className="flex items-center gap-1.5 text-xs text-zinc-400 font-medium">
          <Clock className="w-4 h-4 text-blue-400" /> Trial Period
        </div>
        <div className="text-lg font-bold text-white">14 Days</div>
        <div className="text-[11px] text-zinc-500">Auto-expiring token</div>
      </div>

      <div className="p-3.5 rounded-lg bg-zinc-950 border border-zinc-800 space-y-1">
        <div className="flex items-center gap-1.5 text-xs text-zinc-400 font-medium">
          <ShieldCheck className="w-4 h-4 text-purple-400" /> Security
        </div>
        <div className="text-lg font-bold text-white">Isolated</div>
        <div className="text-[11px] text-zinc-500">Watermark enforced</div>
      </div>
    </div>
  );
}
