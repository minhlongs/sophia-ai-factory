import React from 'react';
import { Link } from '@/navigation';
import { ShieldCheck, ArrowUpRight } from 'lucide-react';

export interface MerkleSettlementBannerProps {
  readonly partnerCode: string;
  readonly commissionRatePct: number;
  readonly locale: string;
}

export function MerkleSettlementBanner({
  partnerCode,
  commissionRatePct,
  locale,
}: Readonly<MerkleSettlementBannerProps>) {
  const isVi = locale === 'vi';

  return (
    <section
      aria-label={
        isVi
          ? 'Bảng hoa hồng đối tác'
          : 'Partner commission overview'
      }
      data-testid="stitch-merkle-settlement-banner"
      className="mx-auto mb-2 max-w-6xl px-4 pt-4 md:px-6"
    >
      <div className="flex flex-col justify-between gap-4 rounded-xl border border-[#F59E0B]/40 bg-[#11131F] p-4 text-[#F8FAFC] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.07)] sm:flex-row sm:items-center">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#F59E0B]/50 bg-[#F59E0B]/15 text-[#F59E0B]">
            <ShieldCheck className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2 font-mono text-[11px]">
              <span className="font-semibold text-[#F59E0B]">
                {isVi ? 'HOA HỒNG ĐỐI TÁC' : 'PARTNER COMMISSIONS'}
              </span>
              <span className="rounded-full border border-[#10B981]/40 bg-[#10B981]/10 px-2 py-0.5 text-[10px] font-semibold text-[#10B981]">
                {commissionRatePct}% {isVi ? 'HOA HỒNG' : 'COMMISSION'} · {partnerCode}
              </span>
            </div>
            <h2 className="mt-1 font-sans text-sm font-semibold text-[#F8FAFC]">
              {isVi
                ? 'Theo dõi mã đối tác và mức hoa hồng áp dụng.'
                : 'Review your partner code and applicable commission rate.'}
            </h2>
          </div>
        </div>

        <Link
          href="/dashboard/control-deck"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-[#1E2235] bg-[#1A1C28] px-3.5 py-2 font-mono text-xs font-semibold text-primary-200 transition-colors hover:border-primary hover:text-[#F8FAFC]"
        >
          <span>{isVi ? 'Mở Bảng Đối Tác' : 'Open Partner Dashboard'}</span>
          <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}
