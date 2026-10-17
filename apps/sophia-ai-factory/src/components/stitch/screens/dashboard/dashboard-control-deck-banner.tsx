'use client';

import React from 'react';
import { useLocale } from 'next-intl';
import { Link } from '@/navigation';
import { Layers, ArrowUpRight } from 'lucide-react';

export function DashboardControlDeckBanner() {
  const isVietnamese = useLocale() === 'vi';
  return (
    <section
      aria-label={isVietnamese ? 'Bản xem trước Director’s Control Deck' : "Director's Control Deck preview"}
      data-testid="dashboard-control-deck-banner"
      className="rounded-xl border border-primary/40 bg-[#11131F] p-4 text-[#F8FAFC] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.07)]"
    >
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-primary/50 bg-primary/15 text-[#C0C1FF]">
            <Layers className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-[#C0C1FF]">
                {isVietnamese ? 'STITCH v4.2 · 9 Ý TƯỞNG GIAO DIỆN' : 'STITCH v4.2 · 9 DESIGN CONCEPTS'}
              </span>
              <span className="rounded-full border border-[#F59E0B]/40 bg-[#F59E0B]/10 px-2 py-0.5 font-mono text-[10px] font-semibold text-[#F59E0B]">
                {isVietnamese ? 'SỐ LIỆU MẪU' : 'SAMPLE TELEMETRY'}
              </span>
            </div>
            <h2 className="mt-1 font-sans text-base font-semibold text-[#F8FAFC]">
              {isVietnamese
                ? 'Director’s Control Deck — Bản xem trước thiết kế'
                : 'Director’s Control Deck — Design Preview'}
            </h2>
            <p className="mt-0.5 text-xs text-[#94A3B8]">
              {isVietnamese
                ? 'Giao diện MAB · Hội đồng 4 cố vấn · Timeline video · Sổ cái thanh toán minh họa'
                : 'MAB interface · 4-advisor council · Video timeline · Illustrative payment ledger'}
            </p>
          </div>
        </div>

        <Link
          href="/dashboard/control-deck"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-primary bg-primary px-4 py-2 font-mono text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <span>{isVietnamese ? 'Mở bản xem trước' : 'Open Design Preview'}</span>
          <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}
