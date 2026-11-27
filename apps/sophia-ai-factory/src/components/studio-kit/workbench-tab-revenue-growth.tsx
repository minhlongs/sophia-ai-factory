'use client';

/**
 * Tab 3 — Revenue & Affiliate Optimization (Thompson Bandit A/B, EPC Anomaly, Pain-Point Miner).
 */

import { useMemo, useState } from 'react';
import {
  createBanditSnapshot,
  selectThompsonWinningArm,
  updateBanditArm,
} from '@/seed/ai/thompson-bandit-engine';
import { createInitialEpcState, evaluateEpcObservation } from '@/seed/analytics/epc-anomaly-detector';
import { filterAndChunkPainComments } from '@/seed/ai/comment-pain-point-miner';

export function WorkbenchTabRevenueGrowth({ locale }: { readonly locale: 'vi' | 'en' }) {
  const [armAConv, setArmAConv] = useState(14);
  const [armBConv, setArmBConv] = useState(29);
  const [latestEpc, setLatestEpc] = useState(0.42);
  const [commentsRaw, setCommentsRaw] = useState(
    'Phí rút USDT sàn này cao quá, có cách nào giảm không?\nLàm sao xác minh KYC nhanh mà không bị treo?\nNice video!\nSo sánh phí Bybit với OKX đi bạn ơi',
  );

  const analytics = useMemo(() => {
    let snap = createBanditSnapshot(['hook-A', 'hook-B']);
    for (let i = 0; i < armAConv; i += 1) snap = updateBanditArm(snap, 'hook-A', true);
    for (let i = 0; i < Math.max(0, 100 - armAConv); i += 1) snap = updateBanditArm(snap, 'hook-A', false);
    for (let i = 0; i < armBConv; i += 1) snap = updateBanditArm(snap, 'hook-B', true);
    for (let i = 0; i < Math.max(0, 100 - armBConv); i += 1) snap = updateBanditArm(snap, 'hook-B', false);
    const winnerId = selectThompsonWinningArm(snap, 2026);

    let epcState = createInitialEpcState();
    const baseline = [1.2, 1.15, 1.25, 1.18, 1.22, 1.19];
    for (const val of baseline) {
      epcState = evaluateEpcObservation(epcState, val).nextState;
    }
    const epcAlert = evaluateEpcObservation(epcState, latestEpc);

    const painChunks = filterAndChunkPainComments(
      commentsRaw
        .split('\n')
        .map((text, idx) => ({ id: `c-${idx}`, text: text.trim(), source: 'youtube' as const }))
        .filter((c) => c.text.length > 0),
    );

    return { winnerId, epcAlert, painChunks };
  }, [armAConv, armBConv, latestEpc, commentsRaw]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="inline-flex items-center rounded-full border border-border bg-muted/50 px-2.5 py-0.5 font-medium text-foreground">
          {locale === 'vi' ? 'Mô Phỏng Tương Tác (Dữ Liệu Mẫu)' : 'Interactive Simulator (Sample Data)'}
        </span>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-2 rounded-xl border border-border bg-card p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-primary-text">
            {locale === 'vi' ? 'So Sánh A/B Tự Động (100 lượt nhấp/mẫu)' : 'Thompson Bandit A/B (100 clicks/arm)'}
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
            <label className="flex flex-col gap-1">
              Hook A ({armAConv} conv)
              <input
                type="range"
                min={0}
                max={60}
                value={armAConv}
                onChange={(e) => setArmAConv(Number(e.target.value))}
              />
            </label>
            <label className="flex flex-col gap-1">
              Hook B ({armBConv} conv)
              <input
                type="range"
                min={0}
                max={60}
                value={armBConv}
                onChange={(e) => setArmBConv(Number(e.target.value))}
              />
            </label>
          </div>
          <p className="text-sm font-medium text-foreground">
            {locale === 'vi' ? 'Biến thể thắng:' : 'Winning Arm:'}{' '}
            <span className="font-mono text-emerald-700 dark:text-emerald-400">
              {analytics.winnerId ?? 'hook-A'}
            </span>
          </p>
        </div>

        <div className="space-y-2 rounded-xl border border-border bg-card p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">
            {locale === 'vi' ? 'Cảnh Báo Tụt Doanh Thu/Click (Mức chuẩn ~$1.20)' : 'EPC Anomaly Detector (Baseline ~$1.20)'}
          </div>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            {locale === 'vi' ? `EPC mô phỏng: $${latestEpc.toFixed(2)}` : `Simulated EPC: $${latestEpc.toFixed(2)}`}
            <input
              type="range"
              min={0.1}
              max={1.8}
              step={0.05}
              value={latestEpc}
              onChange={(e) => setLatestEpc(Number(e.target.value))}
            />
          </label>
          <p className="md3-tabular-nums text-sm font-medium text-foreground">
            {analytics.epcAlert.anomalyDetected
              ? locale === 'vi'
                ? `⚠️ CẢNH BÁO TỤT EPC (Z = ${analytics.epcAlert.zScore.toFixed(2)})`
                : `⚠️ EPC ANOMALY DETECTED (Z = ${analytics.epcAlert.zScore.toFixed(2)})`
              : locale === 'vi'
                ? `✅ EPC ổn định (Z = ${analytics.epcAlert.zScore.toFixed(2)})`
                : `✅ EPC healthy (Z = ${analytics.epcAlert.zScore.toFixed(2)})`}
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <label htmlFor="sophia-pain-point-comments" className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {locale === 'vi' ? 'Khai Thác Nỗi Đau Bình Luận' : 'Comment Pain-Point Miner'}
        </label>
        <textarea
          id="sophia-pain-point-comments"
          rows={3}
          value={commentsRaw}
          onChange={(e) => setCommentsRaw(e.target.value)}
          className="mt-2 w-full rounded-lg border border-border bg-background p-2.5 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <p className="mt-2 text-xs text-emerald-700 dark:text-emerald-400">
          {locale === 'vi'
            ? `Đã lọc & gom ${analytics.painChunks.length} cụm bình luận chứa nỗi đau thực (loại bỏ spam ngắn).`
            : `Filtered & grouped ${analytics.painChunks.length} high-signal pain-point comment chunks.`}
        </p>
      </div>
    </div>
  );
}
