'use client';

import React, { useState } from 'react';
import type {
  BilingualText,
  MabArmTelemetry,
  StitchScreenSpec,
} from '@/seed/types/stitch-control-deck';
import { rebalanceHalfKellyAction } from '@/land/control-deck';
import { MabArmCard } from './control-deck-subcards';

export interface ExecutiveMabPanelProps {
  readonly screen: StitchScreenSpec;
  readonly mabArms: readonly MabArmTelemetry[];
  readonly lang: 'en' | 'vi';
}

export function ExecutiveMabPanel({
  screen,
  mabArms,
  lang,
}: Readonly<ExecutiveMabPanelProps>) {
  const [armsState, setArmsState] = useState<readonly MabArmTelemetry[]>(mabArms);
  const [mcuBudget, setMcuBudget] = useState<number>(2500);
  const [rebalanceReceipt, setRebalanceReceipt] = useState<BilingualText | null>(
    null,
  );
  const [isRebalancing, setIsRebalancing] = useState(false);

  const handleRebalance = async () => {
    setIsRebalancing(true);
    try {
      const res = await rebalanceHalfKellyAction({ mcuBudget });
      if (res.ok) {
        setArmsState(res.mabArms);
        setRebalanceReceipt(res.message);
      }
    } finally {
      setIsRebalancing(false);
    }
  };

  return (
    <section
      aria-labelledby="mab-panel-heading"
      className="min-w-0 rounded-xl border border-[#1E2638] bg-[#121722] p-5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)]"
    >
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-[#1E2638] pb-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-full border border-indigo-400/40 bg-indigo-500/15 px-3 py-0.5 font-mono text-xs text-indigo-300">
              {screen.statusBadge[lang]}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/40 bg-amber-400/10 px-2.5 py-0.5 font-mono text-[11px] font-semibold text-amber-400">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400" aria-hidden="true" />
              {lang === 'vi' ? 'TRẦN HALF-KELLY f* ≤ 25%' : 'HALF-KELLY CAP f* ≤ 25%'}
            </span>
          </div>
          <h2
            id="mab-panel-heading"
            className="mt-2 break-words font-sans text-xl font-semibold tracking-tight text-[#F8FAFC]"
          >
            {screen.title[lang]}
          </h2>
          <p className="mt-1 break-words text-sm text-[#94A3B8]">{screen.subtitle[lang]}</p>
        </div>

        <div className="shrink-0 rounded-lg border border-amber-400/40 bg-[#0B0E14] px-4 py-3 text-right shadow-[inset_0_1px_0_0_rgba(245,158,11,0.18)]">
          <div className="text-xs font-medium text-[#94A3B8]">
            {screen.primaryKpiLabel[lang]}
          </div>
          <div className="font-mono text-2xl font-bold tabular-nums text-amber-400">
            {screen.primaryKpiValue}
          </div>
          <div className="font-mono text-[11px] text-emerald-400">
            {lang === 'vi'
              ? 'Half-Kelly f* = 18.4% · Ngắt lỗ -15%'
              : 'Demo values · Half-Kelly f* = 18.4% · -15% Circuit Breaker'}
          </div>
        </div>
      </header>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[#1E2638] bg-[#0B0E14]/90 px-4 py-3">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
          <label
            htmlFor="mab-mcu-budget-slider"
            className="font-mono text-xs text-indigo-300"
          >
            {lang === 'vi' ? 'Ngân sách MCU:' : 'MCU Pool:'}{' '}
            <strong className="tabular-nums text-[#F8FAFC]">{mcuBudget} MCU</strong>
          </label>
          <input
            id="mab-mcu-budget-slider"
            type="range"
            min={500}
            max={10000}
            step={500}
            value={mcuBudget}
            onChange={(e) => setMcuBudget(Number(e.target.value))}
            aria-label={
              lang === 'vi'
                ? 'Thanh trượt ngân sách MCU Half-Kelly'
                : 'Half-Kelly MCU budget slider'
            }
            className="min-h-[44px] w-full max-w-[180px] cursor-pointer appearance-none rounded-lg bg-transparent accent-amber-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
          />
        </div>
        <button
          type="button"
          disabled={isRebalancing}
          onClick={handleRebalance}
          data-testid="rebalance-half-kelly-btn"
          className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg border border-amber-400/70 bg-amber-400/15 px-4 py-2 font-mono text-xs font-semibold text-amber-400 transition-colors motion-reduce:transition-none hover:bg-amber-400 hover:text-[#0B0E14] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 disabled:opacity-60"
        >
          <span
            aria-hidden="true"
            className={`h-2 w-2 rounded-full ${isRebalancing ? 'animate-ping bg-amber-300 motion-reduce:animate-none' : 'bg-amber-400'}`}
          />
          <span>{lang === 'vi' ? 'Tái Cân Bằng Half-Kelly' : 'Rebalance Half-Kelly'}</span>
        </button>
      </div>

      {rebalanceReceipt && (
        <div
          role="status"
          data-testid="rebalance-half-kelly-receipt"
          className="mt-3 flex items-center gap-2 rounded-lg border border-amber-400/50 bg-amber-400/10 px-3.5 py-2.5 font-mono text-xs text-amber-300"
        >
          <span className="h-2 w-2 shrink-0 rounded-full bg-amber-400" aria-hidden="true" />
          <span className="min-w-0 flex-1 break-words">{rebalanceReceipt[lang]}</span>
        </div>
      )}

      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
        {armsState.map((arm) => (
          <MabArmCard key={arm.armId} arm={arm} lang={lang} />
        ))}
      </div>
    </section>
  );
}
