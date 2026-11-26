'use client';

import { useState } from 'react';

export function HubRoiCalculator({ isVi }: { readonly isVi: boolean }) {
  const [monthlyVolumeUsd, setMonthlyVolumeUsd] = useState(50000);
  const [feeRateBps, setFeeRateBps] = useState(10); // 0.10%
  const [rebatePct, setRebatePct] = useState(30);

  const monthlyFees = (monthlyVolumeUsd * feeRateBps) / 10000;
  const annualSavings = monthlyFees * (rebatePct / 100) * 12;

  return (
    <section className="rounded-xl border border-border bg-card p-5 space-y-4">
      <div>
        <p className="font-mono text-[11px] uppercase tracking-wider text-primary">
          {isVi ? 'CÔNG CỤ TÍNH HOÀN PHÍ CEX / SAAS' : 'CEX FEE-REBATE & SAAS ROI CALCULATOR'}
        </p>
        <h2 className="mt-1 text-base font-semibold text-foreground">
          {isVi ? 'Ước tính tiền hoàn phí giao dịch mỗi năm' : 'Estimate Annual Fee-Rebate Savings'}
        </h2>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 text-xs">
        <label className="flex flex-col gap-1 text-muted-foreground">
          <span>{isVi ? 'Khối lượng / tháng (USD)' : 'Monthly Volume (USD)'}</span>
          <input
            type="number"
            min={1000}
            step={5000}
            value={monthlyVolumeUsd}
            onChange={(e) => setMonthlyVolumeUsd(Math.max(0, Number(e.target.value) || 0))}
            className="rounded-md border border-border bg-background px-2.5 py-1.5 font-mono text-foreground"
          />
        </label>

        <label className="flex flex-col gap-1 text-muted-foreground">
          <span>{isVi ? 'Phí sàn (bps, 10 = 0.1%)' : 'Exchange Fee (bps, 10 = 0.1%)'}</span>
          <input
            type="number"
            min={1}
            max={100}
            value={feeRateBps}
            onChange={(e) => setFeeRateBps(Math.max(1, Number(e.target.value) || 1))}
            className="rounded-md border border-border bg-background px-2.5 py-1.5 font-mono text-foreground"
          />
        </label>

        <label className="flex flex-col gap-1 text-muted-foreground">
          <span>{isVi ? 'Tỷ lệ hoàn phí (%)' : 'Rebate Rate (%)'}</span>
          <input
            type="number"
            min={5}
            max={60}
            value={rebatePct}
            onChange={(e) => setRebatePct(Math.min(60, Math.max(0, Number(e.target.value) || 0)))}
            className="rounded-md border border-border bg-background px-2.5 py-1.5 font-mono text-foreground"
          />
        </label>
      </div>

      <div className="flex items-center justify-between rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3">
        <span className="text-xs font-medium text-emerald-700 dark:text-emerald-300">
          {isVi ? 'Tiết kiệm ước tính / năm' : 'Estimated Annual Savings'}
        </span>
        <span className="font-mono text-lg font-bold text-emerald-600 dark:text-emerald-400">
          ${annualSavings.toLocaleString('en-US', { maximumFractionDigits: 2 })}
        </span>
      </div>
    </section>
  );
}
