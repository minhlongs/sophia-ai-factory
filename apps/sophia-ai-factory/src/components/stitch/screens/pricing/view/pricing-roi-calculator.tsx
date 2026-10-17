'use client';

import React, { useState } from 'react';
import { useLocale } from 'next-intl';
import { UNIFIED_TIERS } from '@/seed/config/tiers/unified-limits';

export function PricingRoiCalculator() {
  const locale = useLocale();
  const isVi = locale === 'vi';
  const [videosPerMonth, setVideosPerMonth] = useState<number>(30);

  const traditionalAgencyCost = videosPerMonth * 150;
  const starterMonthlyCost = UNIFIED_TIERS.BASIC.price;
  const netMonthlySavings = Math.max(0, traditionalAgencyCost - starterMonthlyCost);

  return (
    <section
      aria-labelledby="stitch-roi-calculator-heading"
      data-testid="stitch-pricing-roi-calculator"
      className="mb-24 rounded-2xl border border-[#1E2235] bg-[#11131F] p-6 text-[#F8FAFC] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.07)] md:p-8"
    >
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#1E2235] pb-5">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-[#F59E0B]/40 bg-[#F59E0B]/10 px-3 py-0.5 font-mono text-xs font-semibold text-[#F59E0B]">
            {isVi
              ? 'STITCH v4.2 · MÁY TÍNH TIẾT KIỆM CHI PHÍ DỰNG PHIM'
              : 'STITCH v4.2 · INTERACTIVE EDITOR SAVINGS CALCULATOR'}
          </span>
          <h2
            id="stitch-roi-calculator-heading"
            className="mt-2 font-sans text-2xl font-bold tracking-tight text-[#F8FAFC]"
          >
            {isVi
              ? 'Tính Toán Lợi Tức Đầu Tư (ROI) Khi Tự Động Hóa Video AI'
              : 'Calculate Your Monthly AI Video Automation ROI'}
          </h2>
        </div>

        <span className="rounded-lg border border-[#10B981]/40 bg-[#10B981]/10 px-3.5 py-1.5 font-mono text-xs font-semibold text-[#10B981]">
          {isVi
            ? 'THANH TOÁN: NOWPAYMENTS USDT · PAYOS VIETQR'
            : 'RAILS: NOWPAYMENTS USDT · PAYOS VIETQR'}
        </span>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-xl border border-[#1E2235] bg-[#1A1C28] p-5 lg:col-span-2">
          <div className="flex items-center justify-between">
            <label
              htmlFor="stitch-video-volume-slider"
              className="font-sans text-sm font-medium text-[#E3E1EB]"
            >
              {isVi
                ? 'Số lượng video 9:16 & 16:9 xuất bản mỗi tháng:'
                : 'Monthly 9:16 & 16:9 Videos Published:'}
            </label>
            <span className="font-mono text-xl font-bold text-[#C0C1FF]">
              {videosPerMonth} {isVi ? 'video/tháng' : 'videos/mo'}
            </span>
          </div>

          <input
            id="stitch-video-volume-slider"
            type="range"
            min={10}
            max={120}
            step={5}
            value={videosPerMonth}
            onChange={(e) => setVideosPerMonth(Number(e.target.value))}
            className="mt-4 h-2 w-full cursor-pointer appearance-none rounded-lg bg-[#090A10] accent-primary"
          />

          <div className="mt-4 flex justify-between font-mono text-xs text-[#94A3B8]">
            <span>
              {isVi ? 'Thuê Editor truyền thống (~$150/video):' : 'Traditional Editor (~$150/video):'}{' '}
              <strong className="text-[#F8FAFC]">${traditionalAgencyCost.toLocaleString()}</strong>
            </span>
            <span>
              {isVi ? 'Gói Starter Sophia:' : 'Sophia Starter tier:'}{' '}
              <strong className="text-[#10B981]">${starterMonthlyCost}/mo</strong>
            </span>
          </div>
        </div>

        <div className="flex flex-col justify-between rounded-xl border border-primary/50 bg-[#090A10] p-5">
          <div className="text-xs font-medium text-[#94A3B8]">
            {isVi ? 'Chi Phí Tiết Kiệm Ròng Ước Tính / Tháng' : 'Estimated Net Monthly Savings'}
          </div>
          <div className="my-2 font-mono text-3xl font-bold text-[#F59E0B]">
            ${netMonthlySavings.toLocaleString()} / {isVi ? 'tháng' : 'mo'}
          </div>
          <div className="font-mono text-[11px] text-[#10B981]">
            {isVi
              ? 'Kích hoạt gói tức thì qua NOWPayments USDT IPN'
              : 'Instant tier activation via NOWPayments USDT IPN'}
          </div>
          <p className="mt-3 text-xs leading-relaxed text-[#94A3B8]">
            {isVi
              ? 'Ước tính minh họa: giả định chi phí editor 150 USD/video và gói Starter 199 USD/tháng.'
              : 'Illustrative estimate: assumes a $150 editor cost per video and the $199/month Starter plan.'}
          </p>
        </div>
      </div>
    </section>
  );
}
