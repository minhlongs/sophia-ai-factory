'use client';

import React from 'react';
import { Link } from '@/navigation';
import { ArrowUpRight, ShieldCheck } from 'lucide-react';

export function PricingRoiCalculatorHeader({ isVi }: Readonly<{ isVi: boolean }>) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#1E2235] pb-5">
      <div className="min-w-0">
        <span className="inline-flex items-center gap-2 rounded-full border border-amber-400/40 bg-amber-400/10 px-3 py-1 font-mono text-xs font-semibold text-amber-400">
          {isVi
            ? 'STITCH v4.2 · MÁY TÍNH TIẾT KIỆM CHI PHÍ DỰNG PHIM'
            : 'STITCH v4.2 · INTERACTIVE EDITOR SAVINGS CALCULATOR'}
        </span>
        <h2
          id="stitch-roi-calculator-heading"
          className="mt-2 font-sans text-xl font-bold tracking-tight text-[#F8FAFC] sm:text-2xl"
        >
          {isVi
            ? 'Tính Toán Lợi Tức Đầu Tư (ROI) Khi Tự Động Hóa Video AI'
            : 'Calculate Your Monthly AI Video Automation ROI'}
        </h2>
      </div>

      <span className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-400/40 bg-emerald-400/10 px-3.5 py-2 font-mono text-xs font-semibold text-emerald-400">
        <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span>
          {isVi
            ? 'THANH TOÁN: NOWPAYMENTS USDT · PAYOS VIETQR'
            : 'RAILS: NOWPAYMENTS USDT · PAYOS VIETQR'}
        </span>
      </span>
    </div>
  );
}

export function PricingRoiSummaryCard({
  isVi,
  netMonthlySavings,
}: Readonly<{
  isVi: boolean;
  netMonthlySavings: number;
}>) {
  return (
    <div className="flex min-w-0 flex-col justify-between rounded-xl border border-amber-400/40 bg-[#0B0E14] p-5 shadow-[inset_0_1px_0_0_rgba(245,158,11,0.12)]">
      <div>
        <div className="text-xs font-medium text-[#94A3B8]">
          {isVi ? 'Chi Phí Tiết Kiệm Ròng Ước Tính / Tháng' : 'Estimated Net Monthly Savings'}
        </div>
        <div className="my-2 font-mono text-3xl font-bold text-amber-400">
          ${netMonthlySavings.toLocaleString()} / {isVi ? 'tháng' : 'mo'}
        </div>
        <div className="font-mono text-[11px] text-emerald-400">
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

      <div className="mt-5 flex flex-col gap-2.5">
        <Link
          href="/setup-wizard"
          className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-amber-400 bg-amber-400 px-4 py-2.5 font-mono text-xs font-bold text-[#0B0E14] transition-colors hover:bg-amber-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 motion-reduce:transition-none"
        >
          <span>{isVi ? 'Khởi Tạo Nhà Máy Video AI' : 'Launch AI Video Factory'}</span>
          <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}
