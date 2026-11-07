/**
 * Shared Data State Boundary Presenter
 *
 * Enforces the 6-state OPC Data Truthfulness Contract across Dashboard,
 * Affiliates, Niche Studio, and Approvals (`DESIGN.md` & `SOPHIA_OPC_UX_PRESCRIPTION`).
 * Never renders a failed load or disconnected integration as zero revenue.
 *
 * @module components/stitch/ui/data-state-boundary
 */

'use client';

import React from 'react';
import { Link } from '@/navigation';

export type DataTruthState =
  | 'demo'
  | 'not_connected'
  | 'loading'
  | 'error'
  | 'verified_empty'
  | 'live';

export interface DataStateBoundaryProps {
  /** Current verified data state */
  state: DataTruthState;
  /** Optional custom title override */
  title?: string;
  /** Optional custom description override */
  description?: string;
  /** Optional recovery route (defaults to `/setup` when `state === 'not_connected'`) */
  actionHref?: string;
  /** Optional recovery CTA label */
  actionLabel?: string;
  /** Optional retry callback for `error` state */
  onRetry?: () => void;
  /** Optional locale hint for default copy when no custom strings are supplied */
  isVi?: boolean;
  /** Test identifier prefix */
  testId?: string;
  /** Live content rendered when `state === 'live'` or `'demo'` */
  children?: React.ReactNode;
}

const DEFAULT_STATE_COPY: Record<
  DataTruthState,
  { badgeEn: string; badgeVi: string; titleEn: string; titleVi: string; descEn: string; descVi: string }
> = {
  demo: {
    badgeEn: 'ILLUSTRATIVE PREVIEW',
    badgeVi: 'BẢN XEM TRƯỚC MINH HỌA',
    titleEn: 'Sample workflow preview',
    titleVi: 'Dữ liệu minh họa quy trình',
    descEn: 'Connect your workspace credentials to replace sample figures with live telemetry.',
    descVi: 'Kết nối khóa API của bạn để thay thế dữ liệu minh họa bằng số liệu thực tế.',
  },
  not_connected: {
    badgeEn: 'NOT CONNECTED',
    badgeVi: 'CHƯA KẾT NỐI',
    titleEn: 'Provider connection required',
    titleVi: 'Chưa kết nối nhà cung cấp',
    descEn: 'Complete the Setup Wizard to connect your BYOK or affiliate network credentials.',
    descVi: 'Hoàn tất Trình cài đặt để kết nối khóa BYOK hoặc mạng lưới Affiliate của bạn.',
  },
  loading: {
    badgeEn: 'SYNCING',
    badgeVi: 'ĐANG ĐỒNG BỘ',
    titleEn: 'Loading verified workspace state…',
    titleVi: 'Đang tải dữ liệu xác thực…',
    descEn: 'Fetching live records from D1 ledger.',
    descVi: 'Đang truy xuất bản ghi trực tiếp từ sổ cái D1.',
  },
  error: {
    badgeEn: 'UNAVAILABLE',
    badgeVi: 'KHÔNG KHẢ DỤNG',
    titleEn: 'We could not load this data right now',
    titleVi: 'Không thể tải dữ liệu lúc này',
    descEn: 'A temporary error occurred. Your actual figures are preserved and not zeroed out.',
    descVi: 'Đã xảy ra lỗi tạm thời. Số liệu thực của bạn vẫn được bảo toàn, không bị tính bằng 0.',
  },
  verified_empty: {
    badgeEn: 'VERIFIED EMPTY',
    badgeVi: 'CHƯA CÓ DỮ LIỆU',
    titleEn: 'No records recorded for this period yet',
    titleVi: 'Chưa có bản ghi nào trong kỳ này',
    descEn: 'Your connection is healthy, and no campaigns or conversions have been logged yet.',
    descVi: 'Kết nối hoạt động tốt, hiện chưa phát sinh chiến dịch hoặc chuyển đổi mới.',
  },
  live: {
    badgeEn: 'LIVE',
    badgeVi: 'TRỰC TIẾP',
    titleEn: 'Verified live telemetry',
    titleVi: 'Số liệu thực tế đã xác thực',
    descEn: '',
    descVi: '',
  },
};

export function DataStateBoundary({
  state,
  title,
  description,
  actionHref,
  actionLabel,
  onRetry,
  isVi = false,
  testId = 'data-state-boundary',
  children,
}: DataStateBoundaryProps) {
  const copy = DEFAULT_STATE_COPY[state];
  const badgeText = isVi ? copy.badgeVi : copy.badgeEn;
  const resolvedTitle = title ?? (isVi ? copy.titleVi : copy.titleEn);
  const resolvedDesc = description ?? (isVi ? copy.descVi : copy.descEn);
  const resolvedHref = actionHref ?? (state === 'not_connected' ? '/setup' : undefined);
  const resolvedActionLabel =
    actionLabel ?? (isVi ? 'Mở Trình Cài Đặt' : 'Open Setup Wizard');

  if (state === 'live') {
    return (
      <div data-testid={testId} data-status="live">
        {children}
      </div>
    );
  }

  if (state === 'demo') {
    return (
      <div
        data-testid={testId}
        data-status="demo"
        className="space-y-3 rounded-xl border border-amber-500/30 bg-card dark:bg-[#11131F] p-4"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center rounded bg-amber-500/15 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-amber-400">
            {badgeText}
          </span>
          <span className="text-xs text-muted-foreground">{resolvedDesc}</span>
        </div>
        {children}
      </div>
    );
  }

  return (
    <div
      data-testid={testId}
      data-status={state}
      role={state === 'error' ? 'alert' : 'status'}
      className="v3-core rounded-xl border border-border dark:border-[#1E2235] bg-card dark:bg-[#11131F] p-6 text-center space-y-2"
    >
      <span
        className={`inline-flex items-center rounded px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider ${
          state === 'error'
            ? 'bg-rose-500/15 text-rose-400'
            : state === 'not_connected'
              ? 'bg-amber-500/15 text-amber-400'
              : 'bg-indigo-500/15 text-indigo-400'
        }`}
      >
        {badgeText}
      </span>
      <h3 className="text-sm font-semibold text-foreground dark:text-white">{resolvedTitle}</h3>
      {resolvedDesc && <p className="text-xs text-muted-foreground max-w-md mx-auto">{resolvedDesc}</p>}

      {resolvedHref && (
        <div className="pt-2">
          <Link
            href={resolvedHref}
            className="inline-flex items-center justify-center rounded-lg bg-indigo-600 hover:bg-indigo-500 px-3.5 py-1.5 text-xs font-semibold text-white transition-colors"
          >
            {resolvedActionLabel}
          </Link>
        </div>
      )}

      {state === 'error' && onRetry && (
        <div className="pt-2">
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center justify-center rounded-lg border border-border dark:border-[#1E2235] bg-background dark:bg-[#090A10] px-3.5 py-1.5 text-xs font-semibold text-foreground dark:text-white hover:border-amber-500/40"
          >
            {isVi ? 'Thử lại' : 'Retry'}
          </button>
        </div>
      )}
    </div>
  );
}
