import React from 'react';
import type {
  ControlDeckPaymentEntry,
  StitchTokenSwatches,
} from '@/seed/types/stitch-control-deck';

export interface RevenuePortalsPanelProps {
  readonly settlements: readonly ControlDeckPaymentEntry[];
  readonly tokenSwatches: readonly StitchTokenSwatches[];
  readonly lang: 'en' | 'vi';
}

export function RevenuePortalsPanel({
  settlements,
  tokenSwatches,
  lang,
}: Readonly<RevenuePortalsPanelProps>) {
  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
      {/* Screen 4: NOWPayments USDT + PayOS Merkle Audit Ledger */}
      <section
        aria-labelledby="merkle-ledger-heading"
        className="rounded-xl border border-[#1E2235] bg-[#11131F] p-5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.07)]"
      >
        <header className="flex items-center justify-between border-b border-[#1E2235] pb-3">
          <div>
            <span className="font-mono text-xs text-[#F59E0B]">
              {lang === 'vi' ? 'MÀN HÌNH 04 · SỔ CÁI THANH TOÁN' : 'SCREEN 04 · PAYMENT LEDGER'}
            </span>
            <h2
              id="merkle-ledger-heading"
              className="mt-1 font-sans text-lg font-semibold text-[#F8FAFC]"
            >
              {lang === 'vi'
                ? 'Sổ Cái Thanh Toán & Phân Bổ Hoa Hồng'
                : 'Payment Ledger & Affiliate Attribution'}
            </h2>
          </div>
          <span className="rounded-full border border-[#F59E0B]/40 bg-[#F59E0B]/10 px-3 py-1 font-mono text-xs text-[#F59E0B]">
            {lang === 'vi' ? 'DEMO · CHIA 30%' : 'DEMO · 30% SPLIT'}
          </span>
        </header>

        <div className="mt-4 space-y-3">
          {settlements.map((entry) => (
            <article
              key={entry.txId}
              className="rounded-lg border border-[#1E2235] bg-[#1A1C28] p-3.5"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-mono text-xs font-semibold text-[#F8FAFC]">
                {entry.txId} · {entry.provider[lang]}
                </span>
                <span className="rounded-full border border-border bg-muted/30 px-2.5 py-0.5 font-mono text-[11px] text-muted-foreground">
                  {entry.source === 'account'
                    ? (lang === 'vi' ? 'GIAO DỊCH TÀI KHOẢN' : 'ACCOUNT TRANSACTION')
                    : (lang === 'vi' ? 'MẪU' : 'SAMPLE')}
                </span>
                <span className={`rounded-full border px-2.5 py-0.5 font-mono text-[11px] ${entry.status.en === 'Paid' || entry.status.en === 'Completed' ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400' : entry.status.en === 'Failed' ? 'border-rose-500/40 bg-rose-500/10 text-rose-400' : 'border-amber-500/40 bg-amber-500/10 text-amber-300'}`}>
                  {entry.status[lang]}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 font-mono text-xs">
                <span className="text-[#F59E0B]">
                  {lang === 'vi' ? 'Tổng thu:' : 'Gross:'} {entry.grossAmountUsd}
                </span>
                <span className="text-[#C0C1FF]">
                  {lang === 'vi' ? 'Hoa hồng Affiliate:' : 'Affiliate:'}{' '}
                  {entry.affiliateSplitUsd ?? (lang === 'vi' ? 'Chưa có dữ liệu' : 'Not provided')}
                </span>
                <span className="text-[#94A3B8]">{lang === 'vi' ? 'Mã băm Merkle:' : 'Merkle leaf:'} {entry.merkleLeafHash ?? (lang === 'vi' ? 'Chưa có bằng chứng' : 'Not provided')}</span>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Screen 9: Design System v4.2 Swatches & Specular Tokens */}
      <section
        aria-labelledby="style-guide-heading"
        className="rounded-xl border border-[#1E2235] bg-[#11131F] p-5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.07)]"
      >
        <header className="flex items-center justify-between border-b border-[#1E2235] pb-3">
          <div>
            <span className="font-mono text-xs text-[#10B981]">
              {lang === 'vi' ? 'MÀN HÌNH 09 · HỆ THỐNG THIẾT KẾ STITCH v4.2' : 'SCREEN 09 · STITCH DESIGN SYSTEM v4.2'}
            </span>
            <h2
              id="style-guide-heading"
              className="mt-1 font-sans text-lg font-semibold text-[#F8FAFC]"
            >
              {lang === 'vi'
                ? 'Bảng Token Màu Sắc & Độ Nổi Phản Quang'
                : 'Authoritative Stitch NamedColor & Specular Tokens'}
            </h2>
          </div>
          <span className="rounded-full border border-[#1E2235] bg-[#090A10] px-3 py-1 font-mono text-xs text-[#94A3B8]">
            {lang === 'vi' ? '5/44 MÀU ĐANG HIỂN THỊ' : '5 OF 44 COLORS SHOWN'}
          </span>
        </header>

        <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {tokenSwatches.map((swatch) => (
            <div
              key={swatch.cssVar}
              className="flex items-center gap-3 rounded-lg border border-[#1E2235] bg-[#090A10] p-2.5"
            >
              <span
                aria-hidden="true"
                className="h-8 w-8 shrink-0 rounded-md border border-white/15"
                style={{ backgroundColor: swatch.colorValue }}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1">
                  <span className="truncate font-sans text-xs font-semibold text-[#F8FAFC]">
                    {swatch.name}
                  </span>
                  <span className="font-mono text-[11px] text-[#C0C1FF]">
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
    </div>
  );
}
