'use client';

import React, { useState } from 'react';
import { useLocale } from 'next-intl';
import { UNIFIED_TIERS } from '@/seed/config/tiers/unified-limits';
import {
  PricingRoiCalculatorHeader,
  PricingRoiSummaryCard,
} from './pricing-roi-summary-card';

export { PricingRoiCalculatorHeader, PricingRoiSummaryCard };

const VIDEO_PRESETS = [12, 30, 60, 90] as const;

export function PricingRoiCalculator() {
  const locale = useLocale();
  const isVi = locale === 'vi';
  const [videosPerMonth, setVideosPerMonth] = useState<number>(30);

  const traditionalAgencyCost = videosPerMonth * 150;
  const starterMonthlyCost = UNIFIED_TIERS.BASIC.price;
  const netMonthlySavings = Math.max(0, traditionalAgencyCost - starterMonthlyCost);
  const savingsPct = Math.min(98, Math.round((netMonthlySavings / Math.max(1, traditionalAgencyCost)) * 100));

  return (
    <section
      role="region"
      aria-labelledby="stitch-roi-calculator-heading"
      data-testid="stitch-pricing-roi-calculator"
      className="mb-24 overflow-x-hidden rounded-2xl border border-amber-400/35 bg-gradient-to-br from-[#121722] via-[#11131F] to-[#0B0E14] p-5 text-[#F8FAFC] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)] sm:p-6 md:p-8"
    >
      <PricingRoiCalculatorHeader isVi={isVi} />

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="min-w-0 rounded-xl border border-[#1E2235] bg-[#121722]/90 p-5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)] lg:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label
              htmlFor="stitch-video-volume-slider"
              className="font-sans text-sm font-medium text-[#E3E1EB]"
            >
              {isVi
                ? 'Số lượng video 9:16 & 16:9 xuất bản mỗi tháng:'
                : 'Monthly 9:16 & 16:9 Videos Published:'}
            </label>
            <span className="font-mono text-xl font-bold text-amber-400">
              {videosPerMonth} {isVi ? 'video/tháng' : 'videos/mo'}
            </span>
          </div>

          <div
            role="group"
            aria-label={isVi ? 'Mức sản lượng video cài sẵn' : 'Preset monthly video volumes'}
            className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4"
          >
            {VIDEO_PRESETS.map((preset) => {
              const isSelected = videosPerMonth === preset;
              return (
                <button
                  key={preset}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => setVideosPerMonth(preset)}
                  className={`inline-flex min-h-[44px] items-center justify-center rounded-xl border px-3 py-2 font-mono text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 motion-reduce:transition-none ${
                    isSelected
                      ? 'border-amber-400 bg-amber-400/20 text-amber-300 shadow-[inset_0_1px_0_0_rgba(245,158,11,0.25)]'
                      : 'border-[#1E2235] bg-[#0B0E14] text-[#94A3B8] hover:border-amber-400/40 hover:text-[#F8FAFC]'
                  }`}
                >
                  {preset} {isVi ? 'video' : 'vids'}
                </button>
              );
            })}
          </div>

          <input
            id="stitch-video-volume-slider"
            type="range"
            min={10}
            max={120}
            step={1}
            value={videosPerMonth}
            onChange={(e) => setVideosPerMonth(Number(e.target.value))}
            className="mt-4 min-h-[44px] w-full cursor-pointer appearance-none rounded-lg bg-transparent accent-amber-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
          />

          <div className="mt-3 overflow-hidden rounded-xl border border-[#1E2235] bg-[#0B0E14] p-3">
            <div className="flex items-center justify-between font-mono text-[11px] text-[#94A3B8]">
              <span>{isVi ? 'Tỷ lệ tiết kiệm chi phí ước tính' : 'Estimated cost reduction ratio'}</span>
              <span className="font-semibold text-emerald-400">-{savingsPct}%</span>
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-[#1E2235]">
              <div
                style={{ width: `${savingsPct}%` }}
                className="h-full rounded-full bg-gradient-to-r from-amber-400 to-emerald-400 transition-all duration-300 motion-reduce:transition-none"
              />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap justify-between gap-2 font-mono text-xs text-[#94A3B8]">
            <span>
              {isVi ? 'Thuê Editor truyền thống (~$150/video):' : 'Traditional Editor (~$150/video):'}{' '}
              <strong className="text-[#F8FAFC]">${traditionalAgencyCost.toLocaleString()}</strong>
            </span>
            <span>
              {isVi ? 'Gói Starter Sophia:' : 'Sophia Starter tier:'}{' '}
              <strong className="text-emerald-400">${starterMonthlyCost}/mo</strong>
            </span>
          </div>
        </div>

        <PricingRoiSummaryCard isVi={isVi} netMonthlySavings={netMonthlySavings} />
      </div>
    </section>
  );
}
