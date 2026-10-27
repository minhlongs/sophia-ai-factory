import React from 'react';

export function PipelineMockupHeader() {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 pb-5 border-b border-[#E2E8F0] dark:border-white/[0.08] mb-6">
      <div className="flex items-center gap-2">
        <span className="w-3 h-3 rounded-full bg-rose-500/80" />
        <span className="w-3 h-3 rounded-full bg-amber-500/80" />
        <span className="w-3 h-3 rounded-full bg-emerald-500/80" />
        <span className="ml-3 text-xs font-mono text-slate-500 dark:text-slate-400 hidden sm:inline">
          opc-affiliate-cluster: edge-cf-1.19
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
            OPC FLEET: 10-STEP ENGINE ACTIVE
          </span>
        </div>
      </div>
    </div>
  );
}
