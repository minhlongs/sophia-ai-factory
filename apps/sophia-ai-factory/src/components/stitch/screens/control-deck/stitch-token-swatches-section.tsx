import React from 'react';
import type { StitchTokenSwatches } from '@/seed/types/stitch-control-deck';

export function StitchTokenSwatchesSection({
  tokenSwatches,
  lang,
}: Readonly<{
  tokenSwatches: readonly StitchTokenSwatches[];
  lang: 'en' | 'vi';
}>) {
  return (
    <section
      aria-labelledby="style-guide-heading"
      className="min-w-0 rounded-xl border border-[#1E2638] bg-[#121722] p-5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)]"
    >
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1E2638] pb-3">
        <div className="min-w-0">
          <span className="font-mono text-xs text-emerald-400">
            {lang === 'vi' ? 'MÀN HÌNH 09 · HỆ THỐNG THIẾT KẾ STITCH v4.2' : 'SCREEN 09 · STITCH DESIGN SYSTEM v4.2'}
          </span>
          <h2
            id="style-guide-heading"
            className="mt-1 break-words font-sans text-lg font-semibold text-[#F8FAFC]"
          >
            {lang === 'vi'
              ? 'Bảng Token Màu Sắc & Độ Nổi Phản Quang'
              : 'Authoritative Stitch NamedColor & Specular Tokens'}
          </h2>
        </div>
        <span className="rounded-full border border-emerald-400/35 bg-[#0B0E14] px-3 py-1 font-mono text-xs text-emerald-400">
          {lang === 'vi' ? '5/44 MÀU ĐANG HIỂN THỊ' : '5 OF 44 COLORS SHOWN'}
        </span>
      </header>

      <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {tokenSwatches.map((swatch) => (
          <div
            key={swatch.cssVar}
            className="flex min-w-0 items-center gap-3 rounded-xl border border-[#1E2638] bg-[#0B0E14] p-3 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]"
          >
            <span
              aria-hidden="true"
              className="h-9 w-9 shrink-0 rounded-lg border border-white/20 shadow-inner"
              style={{ backgroundColor: swatch.colorValue }}
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-1">
                <span className="truncate font-sans text-xs font-semibold text-[#F8FAFC]">
                  {swatch.name}
                </span>
                <span className="font-mono text-[11px] text-indigo-300">
                  {swatch.cssVar}
                </span>
              </div>
              <div className="truncate font-mono text-[10px] text-[#94A3B8]">
                {swatch.role[lang]}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
