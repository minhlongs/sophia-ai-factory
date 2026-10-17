import React from 'react';
import { useLocale } from 'next-intl';
import { Link } from '@/navigation';
import { Smartphone, ArrowUpRight } from 'lucide-react';

export function StitchMobileCompanionBanner() {
  const isVi = useLocale() === 'vi';

  return (
    <section
      aria-label={isVi ? 'Bản xem trước trải nghiệm di động' : 'Mobile workflow design preview'}
      data-testid="stitch-mobile-companion-banner"
      className="mb-6 rounded-xl border border-[#A855F7]/40 bg-[#11131F] p-4 text-[#F8FAFC] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.07)]"
    >
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#A855F7]/50 bg-[#A855F7]/15 text-[#D6A9FF]">
            <Smartphone className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2 font-mono text-[11px]">
              <span className="font-semibold text-[#D6A9FF]">
                {isVi ? 'TRẢI NGHIỆM DI ĐỘNG · BẢN XEM TRƯỚC' : 'MOBILE WORKFLOW · DESIGN PREVIEW'}
              </span>
              <span className="rounded-full border border-[#10B981]/40 bg-[#10B981]/10 px-2 py-0.5 text-[10px] font-semibold text-[#10B981]">
                {isVi ? 'Ý TƯỞNG GIAO DIỆN' : 'UI CONCEPT'}
              </span>
            </div>
            <h2 className="mt-1 font-sans text-sm font-semibold text-[#F8FAFC]">
              {isVi
                ? 'Phác thảo quy trình duyệt video và nhận thông báo thanh toán trên di động.'
                : 'A concept for mobile video approvals and payment notifications.'}
            </h2>
          </div>
        </div>

        <Link
          href="/dashboard/control-deck"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-[#1E2235] bg-[#1A1C28] px-3.5 py-2 font-mono text-xs font-semibold text-primary-200 transition-colors hover:border-primary hover:text-[#F8FAFC]"
        >
          <span>{isVi ? 'Bàn Điều Khiển Di Động' : 'Mobile Deck'}</span>
          <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}
