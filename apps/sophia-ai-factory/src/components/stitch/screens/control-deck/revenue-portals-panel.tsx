import React from 'react';
import type {
  ControlDeckPaymentEntry,
  StitchTokenSwatches,
} from '@/seed/types/stitch-control-deck';
import { StitchTokenSwatchesSection } from './stitch-token-swatches-section';

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
    <div className="grid min-w-0 grid-cols-1 gap-6 xl:grid-cols-2">
      <section
        aria-labelledby="merkle-ledger-heading"
        className="min-w-0 rounded-xl border border-[#1E2638] bg-[#121722] p-5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)]"
      >
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1E2638] pb-3">
          <div className="min-w-0">
            <span className="font-mono text-xs text-amber-400">
              {lang === 'vi' ? 'MÀN HÌNH 04 · SỔ CÁI THANH TOÁN' : 'SCREEN 04 · PAYMENT LEDGER'}
            </span>
            <h2
              id="merkle-ledger-heading"
              className="mt-1 break-words font-sans text-lg font-semibold text-[#F8FAFC]"
            >
              {lang === 'vi'
                ? 'Sổ Cái Thanh Toán & Phân Bổ Hoa Hồng'
                : 'Payment Ledger & Affiliate Attribution'}
            </h2>
          </div>
          <span className="rounded-full border border-amber-400/40 bg-amber-400/10 px-3 py-1 font-mono text-xs font-semibold text-amber-400">
            {lang === 'vi' ? 'DEMO · CHIA 30%' : 'DEMO · 30% SPLIT'}
          </span>
        </header>

        <div className="mt-4 space-y-3">
          {settlements.map((entry) => {
            const isPaid = entry.status.en === 'Paid' || entry.status.en === 'Completed';
            const isFailed = entry.status.en === 'Failed';
            return (
              <article
                key={entry.txId}
                className="min-w-0 rounded-xl border border-[#1E2638] bg-[#0B0E14] p-3.5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="min-w-0 break-words font-mono text-xs font-semibold text-[#F8FAFC]">
                    {entry.txId} · {entry.provider[lang]}
                  </span>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="rounded-full border border-[#1E2638] bg-[#121722] px-2.5 py-0.5 font-mono text-[11px] text-[#94A3B8]">
                      {entry.source === 'account'
                        ? (lang === 'vi' ? 'GIAO DỊCH TÀI KHOẢN' : 'ACCOUNT TRANSACTION')
                        : (lang === 'vi' ? 'MẪU' : 'SAMPLE')}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[11px] font-semibold ${
                        isPaid
                          ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-400'
                          : isFailed
                            ? 'border-rose-500/40 bg-rose-500/10 text-rose-400'
                            : 'border-amber-400/40 bg-amber-400/10 text-amber-300'
                      }`}
                    >
                      <span
                        aria-hidden="true"
                        className={`h-1.5 w-1.5 rounded-full ${
                          isPaid ? 'bg-emerald-400' : isFailed ? 'bg-rose-400' : 'bg-amber-400'
                        }`}
                      />
                      {entry.status[lang]}
                    </span>
                  </div>
                </div>
                <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 border-t border-[#1E2638]/80 pt-2 font-mono text-xs">
                  <span className="tabular-nums text-amber-400">
                    {lang === 'vi' ? 'Tổng thu:' : 'Gross:'} {entry.grossAmountUsd}
                  </span>
                  <span className="tabular-nums text-indigo-300">
                    {lang === 'vi' ? 'Hoa hồng Affiliate:' : 'Affiliate:'}{' '}
                    {entry.affiliateSplitUsd ?? (lang === 'vi' ? 'Chưa có dữ liệu' : 'Not provided')}
                  </span>
                  <span className="break-all text-[#94A3B8]">
                    {lang === 'vi' ? 'Mã băm Merkle:' : 'Merkle leaf:'}{' '}
                    {entry.merkleLeafHash ?? (lang === 'vi' ? 'Chưa có bằng chứng' : 'Not provided')}
                  </span>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <StitchTokenSwatchesSection tokenSwatches={tokenSwatches} lang={lang} />
    </div>
  );
}
