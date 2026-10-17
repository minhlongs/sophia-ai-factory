import React from 'react';
import { Link } from '@/navigation';
import { Building2, ArrowUpRight } from 'lucide-react';

export interface StitchAgencySubaccountStripProps {
  readonly isVi: boolean;
}

export function StitchAgencySubaccountStrip({
  isVi,
}: Readonly<StitchAgencySubaccountStripProps>) {
  return (
    <section
      aria-label={
        isVi
          ? 'Cổng Quản Trị Subaccount Đại Lý White-Label Stitch v4.2'
          : 'Stitch v4.2 White-Label Agency Subaccount Portal'
      }
      data-testid="stitch-agency-subaccount-strip"
      className="mx-auto max-w-7xl px-4 pt-6 md:px-8"
    >
      <div className="flex flex-col justify-between gap-4 rounded-xl border border-primary/40 bg-[#11131F] p-4 text-[#F8FAFC] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.07)] sm:flex-row sm:items-center">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-primary/50 bg-primary/15 text-primary-200">
            <Building2 className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2 font-mono text-[11px]">
              <span className="font-semibold text-primary-200">
                {isVi ? 'BẢN XEM TRƯỚC · QUẢN LÝ SUBACCOUNT' : 'DESIGN PREVIEW · AGENCY SUBACCOUNTS'}
              </span>
              <span className="rounded-full border border-[#10B981]/40 bg-[#10B981]/10 px-2 py-0.5 text-[10px] font-semibold text-[#10B981]">
                {isVi ? 'BẢN MẪU GIAO DIỆN' : 'UI CONCEPT'}
              </span>
            </div>
            <h2 className="mt-1 font-sans text-sm font-semibold text-[#F8FAFC]">
              {isVi
                ? 'Quản lý subaccount, hạn mức theo tenant và báo cáo song ngữ.'
                : 'Manage agency subaccounts, tenant quotas, and bilingual reports.'}
            </h2>
          </div>
        </div>

        <Link
          href="/dashboard/control-deck"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-primary bg-primary px-3.5 py-2 font-mono text-xs font-semibold text-[#F8FAFC] transition-colors hover:bg-primary-700"
        >
          <span>{isVi ? 'Mở Bàn Chỉ Huy Đại Lý' : 'Open Agency Deck'}</span>
          <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}
