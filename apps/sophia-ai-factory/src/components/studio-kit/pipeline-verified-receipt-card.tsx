'use client';

/**
 * 39/39 Engine Verified Receipt Card (MD3 Expressive + AEO Citation Surface).
 *
 * Screenshot-ready proof card rendered when a live pipeline run completes.
 * Displays real server compute metrics, honest telemetry source badge
 * (LIVE D1 DATA vs STANDARD SAMPLE BRIEF), SubID HMAC seal, BigInt ledger
 * verdict, and a 4-state Copy Receipt button.
 *
 * @module components/studio-kit/pipeline-verified-receipt-card
 */

import { useState } from 'react';
import {
  formatReceiptClipboardText,
  type PipelineVerifiedReceipt,
} from '@/seed/ui/pipeline-stage-manifest';

export interface PipelineVerifiedReceiptCardProps {
  readonly locale: 'vi' | 'en';
  readonly receipt: PipelineVerifiedReceipt | null;
}

export function PipelineVerifiedReceiptCard({
  locale,
  receipt,
}: PipelineVerifiedReceiptCardProps) {
  const [copyState, setCopyState] = useState<'idle' | 'copying' | 'copied' | 'error'>('idle');
  const [copyError, setCopyError] = useState<string | null>(null);

  if (!receipt) return null;

  const isLiveD1 = receipt.telemetrySource === 'live_d1';

  async function handleCopy() {
    if (!receipt || copyState === 'copying') return;
    setCopyState('copying');
    setCopyError(null);
    try {
      if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
        throw new Error(
          locale === 'vi'
            ? 'Trình duyệt không hỗ trợ sao chép tự động.'
            : 'Clipboard API unavailable in this browser.',
        );
      }
      await navigator.clipboard.writeText(formatReceiptClipboardText(receipt, locale));
      setCopyState('copied');
      setTimeout(() => setCopyState('idle'), 2200);
    } catch (err) {
      setCopyState('error');
      setCopyError(
        err instanceof Error
          ? err.message
          : locale === 'vi'
            ? 'Không thể sao chép biên nhận.'
            : 'Failed to copy receipt.',
      );
    }
  }

  return (
    <section
      data-testid="pipeline-verified-receipt-card"
      aria-label={
        locale === 'vi'
          ? 'Biên nhận xác thực 39 động cơ'
          : '39-Engine Verified Receipt'
      }
      className="md3-surface-tonal aeo-citation-surface rounded-2xl border border-amber-500/35 p-4 sm:p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-code text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300">
              {locale === 'vi'
                ? 'BIÊN NHẬN XÁC THỰC 39/39 ĐỘNG CƠ • SOPHIA AI FACTORY'
                : '39/39 ENGINE VERIFIED RECEIPT • SOPHIA AI FACTORY'}
            </span>
            <span
              data-testid="receipt-telemetry-source"
              className={`font-code rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                isLiveD1
                  ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              {isLiveD1
                ? locale === 'vi'
                  ? 'DỮ LIỆU D1 THỰC TẾ'
                  : 'LIVE D1 DATA'
                : locale === 'vi'
                  ? 'KỊCH BẢN MẪU CHUẨN'
                  : 'STANDARD SAMPLE BRIEF'}
            </span>
          </div>
          <p className="font-code md3-tabular-nums text-[11px] text-muted-foreground">
            {receipt.executedAt}
          </p>
        </div>

        <button
          type="button"
          data-testid="copy-verified-receipt-btn"
          disabled={copyState === 'copying'}
          onClick={() => void handleCopy()}
          className="md3-pill-button inline-flex min-h-[44px] items-center border border-primary/35 bg-primary/10 px-4 text-xs font-semibold text-primary-text transition-colors hover:bg-primary/20 disabled:opacity-50"
        >
          {copyState === 'copying'
            ? locale === 'vi'
              ? 'Đang sao chép…'
              : 'Copying…'
            : copyState === 'copied'
              ? locale === 'vi'
                ? 'Đã sao chép!'
                : 'Copied!'
              : locale === 'vi'
                ? 'Sao chép Biên nhận'
                : 'Copy Verified Receipt'}
        </button>
      </div>

      {copyError ? (
        <p role="alert" className="mt-2 text-xs font-medium text-destructive">
          {copyError}
        </p>
      ) : null}

      <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-border bg-card/80 p-3">
          <div className="text-[11px] text-muted-foreground">
            {locale === 'vi' ? 'Động cơ đạt chuẩn' : 'Engines Verified'}
          </div>
          <div className="font-code md3-tabular-nums mt-0.5 text-sm font-bold text-foreground">
            {receipt.passedCount}/{receipt.totalEngines} Passed
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card/80 p-3">
          <div className="text-[11px] text-muted-foreground">
            {locale === 'vi' ? 'Thời gian Edge' : 'Edge Compute'}
          </div>
          <div className="font-code md3-tabular-nums mt-0.5 text-sm font-bold text-foreground">
            {receipt.totalComputeMs.toFixed(1)} ms
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card/80 p-3">
          <div className="text-[11px] text-muted-foreground">
            {locale === 'vi' ? 'Dấu SubID HMAC' : 'S2S SubID Seal'}
          </div>
          <div className="font-code mt-0.5 truncate text-xs font-bold text-foreground">
            {receipt.subIdWatermark}
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card/80 p-3">
          <div className="text-[11px] text-muted-foreground">
            {locale === 'vi' ? 'Sổ cái BigInt' : 'BigInt Ledger'}
          </div>
          <div className="font-code mt-0.5 truncate text-xs font-bold text-emerald-700 dark:text-emerald-300">
            {receipt.waterfallSplit} • {receipt.reconciliationVerdict}
          </div>
        </div>
      </div>
    </section>
  );
}
