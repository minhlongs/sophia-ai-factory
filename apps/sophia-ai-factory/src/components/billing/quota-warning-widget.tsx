'use client';

import React from 'react';

/**
 * Props for QuotaWarningWidget.
 */
export interface QuotaWarningWidgetProps {
  /** Number of MCU units used in the current billing cycle */
  usedMcu: number;
  /** Total MCU units allocated for the current billing cycle */
  totalMcu: number;
  /** Active user locale, defaults to 'en' */
  locale?: string;
  /** Optional additional CSS class names */
  className?: string;
}

/**
 * Quota Warning Widget — Sophia AI Factory.
 *
 * Provides proactive tenant feedback as MCU consumption approaches limits:
 * - < 80%: Hidden (null) to reduce dashboard noise.
 * - 80% to 99%: Amber warning banner advising plan upgrade.
 * - >= 100%: Red critical alert indicating new mission execution is paused.
 *
 * Bilingual: Vietnamese (vi) and English (en).
 */
export function QuotaWarningWidget({
  usedMcu,
  totalMcu,
  locale = 'en',
  className = '',
}: QuotaWarningWidgetProps): React.JSX.Element | null {
  if (!totalMcu || totalMcu <= 0) {
    return null;
  }

  const rawPercent = (usedMcu / totalMcu) * 100;
  const percent = Math.floor(rawPercent);

  // Suppress banner below 80% threshold
  if (percent < 80) {
    return null;
  }

  const isCritical = percent >= 100;
  const isVi = locale?.toLowerCase().startsWith('vi');

  // Text definitions matching specification
  const warningText = isVi
    ? `⚠️ Cảnh báo: Bạn đã sử dụng ${percent}% hạn mức MCU hàng tháng. Vui lòng nâng cấp gói để tránh gián đoạn mission.`
    : `⚠️ Warning: You have used ${percent}% of your monthly MCU quota. Consider upgrading your plan to prevent mission interruptions.`;

  const criticalText = isVi
    ? '🚨 Hết hạn mức: Đã dùng 100% MCU. Các mission mới sẽ tạm dừng cho đến kỳ gia hạn hoặc nạp thêm.'
    : '🚨 Limit Reached: 100% of MCU quota used. New missions will be paused until renewal or top-up.';

  const message = isCritical ? criticalText : warningText;

  return (
    <div
      role="alert"
      aria-live={isCritical ? 'assertive' : 'polite'}
      data-testid={isCritical ? 'quota-critical-alert' : 'quota-warning-alert'}
      data-percent={percent}
      className={`rounded-lg border p-3.5 text-sm font-medium transition-all ${
        isCritical
          ? 'border-red-500/40 bg-red-500/10 text-red-800 dark:border-red-500/30 dark:bg-red-950/40 dark:text-red-200'
          : 'border-amber-500/40 bg-amber-500/10 text-amber-900 dark:border-amber-500/30 dark:bg-amber-950/40 dark:text-amber-200'
      } ${className}`}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="leading-relaxed">{message}</p>
        <div className="flex-shrink-0">
          <span
            className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold ${
              isCritical
                ? 'bg-red-500/20 text-red-700 dark:text-red-300'
                : 'bg-amber-500/20 text-amber-800 dark:text-amber-300'
            }`}
          >
            {isCritical ? '100%+' : `${percent}%`}
          </span>
        </div>
      </div>
    </div>
  );
}

export default QuotaWarningWidget;
