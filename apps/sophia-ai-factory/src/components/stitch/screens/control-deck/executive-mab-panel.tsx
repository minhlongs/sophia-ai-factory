'use client';

import React, { useState } from 'react';
import type {
  BilingualText,
  MabArmTelemetry,
  StitchScreenSpec,
} from '@/seed/types/stitch-control-deck';
import { rebalanceHalfKellyAction } from '@/land/control-deck';

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
      className="rounded-xl border border-[#1E2235] bg-[#11131F] p-5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.07)]"
    >
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-[#1E2235] pb-4">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-3 py-0.5 font-mono text-xs text-[#C0C1FF]">
            {screen.statusBadge[lang]}
          </span>
          <h2
            id="mab-panel-heading"
            className="mt-2 font-sans text-xl font-semibold tracking-tight text-[#F8FAFC]"
          >
            {screen.title[lang]}
          </h2>
          <p className="mt-1 text-sm text-[#94A3B8]">{screen.subtitle[lang]}</p>
        </div>

        <div className="rounded-lg border border-[#F59E0B]/40 bg-[#1A1C28] px-4 py-3 text-right">
          <div className="text-xs font-medium text-[#94A3B8]">
            {screen.primaryKpiLabel[lang]}
          </div>
          <div className="font-mono text-2xl font-bold text-[#F59E0B]">
            {screen.primaryKpiValue}
          </div>
          <div className="font-mono text-[11px] text-[#10B981]">
            {lang === 'vi'
              ? 'Half-Kelly f* = 18.4% · Ngắt lỗ -15%'
              : 'Demo values · Half-Kelly f* = 18.4% · -15% Circuit Breaker'}
          </div>
        </div>
      </header>

      {/* Interactive MCU Half-Kelly Rebalancer Bar */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-4 rounded-lg border border-[#1E2235] bg-[#1A1C28]/70 px-4 py-3">
        <div className="flex flex-1 flex-wrap items-center gap-3">
          <label
            htmlFor="mab-mcu-budget-slider"
            className="font-mono text-xs text-[#C0C1FF]"
          >
            {lang === 'vi' ? 'Ngân sách MCU:' : 'MCU Pool:'}{' '}
            <strong className="text-[#F8FAFC]">{mcuBudget} MCU</strong>
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
            className="h-2 w-40 cursor-pointer appearance-none rounded-lg bg-[#090A10] accent-[#6366F1]"
          />
        </div>
        <button
          type="button"
          disabled={isRebalancing}
          onClick={handleRebalance}
          data-testid="rebalance-half-kelly-btn"
          className="rounded-lg border border-[#F59E0B]/60 bg-[#F59E0B]/15 px-3 py-1.5 font-mono text-xs font-semibold text-[#F59E0B] transition-colors hover:bg-[#F59E0B] hover:text-[#090A10] disabled:opacity-60"
        >
          {lang === 'vi' ? 'Tái Cân Bằng Half-Kelly' : 'Rebalance Half-Kelly'}
        </button>
      </div>

      {rebalanceReceipt && (
        <div
          role="status"
          data-testid="rebalance-half-kelly-receipt"
          className="mt-3 rounded-lg border border-[#F59E0B]/40 bg-[#F59E0B]/10 px-3 py-2 font-mono text-xs text-[#F59E0B]"
        >
          {rebalanceReceipt[lang]}
        </div>
      )}

      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
        {armsState.map((arm) => (
          <article
            key={arm.armId}
            aria-label={arm.hookName[lang]}
            className={`rounded-lg border p-4 transition-colors duration-150 motion-reduce:transition-none ${
              arm.isChampion
                ? 'border-primary bg-[#1A1C28] shadow-[0_0_16px_hsl(var(--primary)/0.2)]'
                : 'border-[#1E2235] bg-[#090A10]/80'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-xs text-[#94A3B8]">{arm.armId}</span>
              {arm.isChampion ? (
                <span className="rounded-full border border-[#10B981]/40 bg-[#10B981]/15 px-2.5 py-0.5 font-mono text-[11px] font-semibold text-[#10B981]">
                  {lang === 'vi' ? 'NHÁNH DẪN ĐẦU' : 'CHAMPION ARM'}
                </span>
              ) : (
                <span className="rounded-full border border-[#1E2235] bg-[#11131F] px-2.5 py-0.5 font-mono text-[11px] text-[#94A3B8]">
                  {lang === 'vi' ? 'ĐANG THỬ NGHIỆM' : 'EXPLORING'}
                </span>
              )}
            </div>

            <h3 className="mt-2 font-sans text-sm font-semibold text-[#F8FAFC]">
              {arm.hookName[lang]}
            </h3>

            <dl className="mt-4 grid grid-cols-3 gap-2 border-t border-[#1E2235] pt-3 font-mono text-xs">
              <div>
                <dt className="text-[11px] text-[#94A3B8]">Beta(α,β)</dt>
                <dd className="mt-0.5 font-semibold text-[#F8FAFC]">
                  ({arm.alpha},{arm.beta})
                </dd>
              </div>
              <div>
                <dt className="text-[11px] text-[#94A3B8]">
                  {lang === 'vi' ? 'Xác Suất Thắng' : 'Win Prob'}
                </dt>
                <dd className="mt-0.5 font-semibold text-[#10B981]">
                  {arm.winProbabilityPct}%
                </dd>
              </div>
              <div>
                <dt className="text-[11px] text-[#94A3B8]">Half-Kelly</dt>
                <dd className="mt-0.5 font-semibold text-[#F59E0B]">
                  {arm.halfKellyAllocationPct}% ({arm.roasMultiplier})
                </dd>
              </div>
            </dl>
          </article>
        ))}
      </div>
    </section>
  );
}
