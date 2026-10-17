import React from 'react';
import { useLocale } from 'next-intl';
import { Link } from '@/navigation';
import { Film, Sparkles, ArrowUpRight } from 'lucide-react';

export function StitchStudioDeckStrip() {
  const isVi = useLocale() === 'vi';

  return (
    <section
      aria-label={isVi ? 'Bản xem trước quy trình phòng dựng video AI' : 'AI video studio workflow preview'}
      data-testid="stitch-studio-deck-strip"
      className="mt-5 rounded-xl border border-primary/40 bg-[#11131F] p-4 text-[#F8FAFC] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.07)]"
    >
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-primary/50 bg-primary/15 text-primary-200">
            <Film className="h-4 w-4" aria-hidden="true" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2 font-mono text-[11px]">
              <span className="font-semibold text-primary-200">
                {isVi ? 'PHÒNG DỰNG VIDEO AI · BẢN XEM TRƯỚC' : 'AI VIDEO STUDIO · DESIGN PREVIEW'}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-[#A855F7]/40 bg-[#A855F7]/15 px-2 py-0.5 text-[10px] font-semibold text-[#D6A9FF]">
                <Sparkles className="h-3 w-3" aria-hidden="true" />
                {isVi ? 'Ý TƯỞNG GIAO DIỆN' : 'CONCEPT UI'}
              </span>
            </div>
            <p className="mt-1 text-xs text-[#94A3B8]">
              {isVi
                ? 'Quy trình biên tập video nhiều khung hình và bản nháp chiến dịch.'
                : 'A preview of multi-format video editing and campaign planning.'}
            </p>
          </div>
        </div>

        <Link
          href="/dashboard/control-deck"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-primary bg-[#1A1C28] px-3.5 py-2 font-mono text-xs font-semibold text-[#F8FAFC] transition-colors hover:bg-primary"
        >
          <span>{isVi ? 'Mở Bàn Điều Khiển' : 'Open Studio Deck'}</span>
          <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}
