'use client';

import React, { useState, useTransition } from 'react';
import type { CockpitExecutiveSnapshot } from '../affiliate-cockpit-types';
import { toggleAffiliateKillSwitchAction } from '../../actions/toggle-kill-switch-action';

interface AffiliateCockpitViewProps {
  snapshot: CockpitExecutiveSnapshot;
  onToggleKillSwitch?: (active: boolean) => void;
  locale?: 'en' | 'vi';
}

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100);
}

export function AffiliateCockpitView({
  snapshot,
  onToggleKillSwitch,
  locale = 'vi',
}: AffiliateCockpitViewProps) {
  const { metrics, topPerformingHooks } = snapshot;
  const [active, setActive] = useState(snapshot.killSwitchActive);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleToggle = () => {
    const nextState = !active;
    setActive(nextState);
    setErrorMessage(null);
    onToggleKillSwitch?.(nextState);

    startTransition(async () => {
      const result = await toggleAffiliateKillSwitchAction({
        active: nextState,
        tenantId: snapshot.tenantId,
      });

      if (!result.ok) {
        // Rollback state on failure
        setActive(!nextState);
        setErrorMessage(result.error.message);
      }
    });
  };

  const t = {
    title: locale === 'vi' ? 'Bảng Điều Khiển Doanh Thu & Rủi Ro Affiliate' : 'Affiliate Revenue & Risk Cockpit',
    subtitle: locale === 'vi' ? 'Theo dõi hoa hồng thực nhận, ký quỹ rủi ro 10% và thuật toán nhân bản video' : 'Monitor net commissions, 10% risk holdback, and video scaling pace',
    gross: locale === 'vi' ? 'Tổng Doanh Thu (Gross)' : 'Gross Revenue',
    holdback: locale === 'vi' ? 'Ký Quỹ Rủi Ro (10% Holdback)' : 'Risk Reserve (10% Holdback)',
    netPayable: locale === 'vi' ? 'Hoa Hồng Thực Nhận (Net)' : 'Net Payable Commission',
    refundRate: locale === 'vi' ? 'Tỷ Lệ Hoàn Tiền' : 'Refund Rate',
    riskWarning: locale === 'vi' ? 'Cảnh báo: Tỷ lệ hoàn đơn vượt ngưỡng 15%' : 'Alert: Refund rate exceeds 15% threshold',
    winners: locale === 'vi' ? 'Hook Đột Phá (Scale 4x)' : 'Scaling Winners (4x/day)',
    pruned: locale === 'vi' ? 'Hook Cắt Tỉa (0x)' : 'Pruned Hooks (0/day)',
    killSwitch: locale === 'vi' ? 'Khóa Dừng Khẩn Cấp (Kill Switch)' : 'Emergency Kill Switch',
    killSwitchActiveText: locale === 'vi' ? 'ĐANG KÍCH HOẠT (ĐÃ DỪNG SẢN XUẤT)' : 'ACTIVE (ALL PRODUCTION PAUSED)',
    killSwitchNormalText: locale === 'vi' ? 'BÌNH THƯỜNG (TỰ ĐỘNG CHẠY)' : 'NORMAL (RUNNING AUTONOMOUSLY)',
    topHooksTitle: locale === 'vi' ? 'Xếp Hạng Video Hook Theo Hiệu Suất (EPC)' : 'Video Hook Ranking by EPC',
    hookCol: locale === 'vi' ? 'Tên Hook' : 'Hook Name',
    cadenceCol: locale === 'vi' ? 'Tần Suất / Ngày' : 'Daily Pace',
    actionCol: locale === 'vi' ? 'Trạng Thái' : 'Status',
    updating: locale === 'vi' ? 'Đang cập nhật...' : 'Updating...',
  };

  return (
    <div className="w-full space-y-6 rounded-xl border border-border bg-card p-6 text-card-foreground shadow-sm">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground">{t.title}</h2>
          <p className="text-sm text-muted-foreground">{t.subtitle}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={isPending}
              onClick={handleToggle}
              className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors ${
                active
                  ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                  : 'bg-primary text-primary-foreground hover:bg-primary/90'
              } ${isPending ? 'opacity-70 cursor-not-allowed' : ''}`}
            >
              {isPending ? t.updating : active ? t.killSwitchActiveText : t.killSwitchNormalText}
            </button>
          </div>
          {errorMessage && (
            <p className="text-xs text-destructive font-medium">{errorMessage}</p>
          )}
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-border/50 bg-background/50 p-4">
          <p className="text-xs font-medium text-muted-foreground">{t.gross}</p>
          <p className="mt-1 text-2xl font-bold text-foreground">
            {formatCurrency(metrics.totalGrossCommissionCents)}
          </p>
        </div>

        <div className="rounded-lg border border-border/50 bg-background/50 p-4">
          <p className="text-xs font-medium text-muted-foreground">{t.holdback}</p>
          <p className="mt-1 text-2xl font-bold text-amber-500">
            {formatCurrency(metrics.totalHoldbackReserveCents)}
          </p>
        </div>

        <div className="rounded-lg border border-border/50 bg-background/50 p-4">
          <p className="text-xs font-medium text-muted-foreground">{t.netPayable}</p>
          <p className="mt-1 text-2xl font-bold text-emerald-500">
            {formatCurrency(metrics.totalNetPayableCents)}
          </p>
        </div>

        <div className="rounded-lg border border-border/50 bg-background/50 p-4">
          <p className="text-xs font-medium text-muted-foreground">{t.refundRate}</p>
          <p className={`mt-1 text-2xl font-bold ${metrics.isRefundRiskAlert ? 'text-destructive' : 'text-foreground'}`}>
            {metrics.effectiveRefundRatePercent}%
          </p>
          {metrics.isRefundRiskAlert && (
            <p className="mt-1 text-[11px] font-medium text-destructive">{t.riskWarning}</p>
          )}
        </div>
      </div>

      {/* Hook Performance Table */}
      <div className="rounded-lg border border-border/50">
        <div className="border-b border-border/50 bg-muted/40 px-4 py-3">
          <h3 className="text-sm font-semibold text-foreground">{t.topHooksTitle}</h3>
        </div>
        <div className="divide-y divide-border/50">
          {topPerformingHooks.map((hook) => (
            <div key={hook.campaignId} className="flex flex-col justify-between gap-2 p-4 sm:flex-row sm:items-center">
              <div>
                <p className="text-sm font-semibold text-foreground">{hook.hookName}</p>
                <p className="text-xs text-muted-foreground">
                  CTR: {hook.ctrPercent}% | CVR: {hook.cvrPercent}% | EPC: ${ (hook.epcCents / 100).toFixed(2) }
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs font-medium text-muted-foreground">
                  {hook.recommendedDailyVideos} video/ngày
                </span>
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    hook.action === 'SCALE_AGGRESSIVE'
                      ? 'bg-emerald-500/10 text-emerald-500'
                      : hook.action === 'KILL_PRUNE'
                        ? 'bg-destructive/10 text-destructive'
                        : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {hook.action}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
