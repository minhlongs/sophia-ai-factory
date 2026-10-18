/**
 * Provider Health Status Badge Configuration & Bilingual Metadata
 *
 * @module tree/byok/provider-status-badges
 */

import type { ProviderHealthStatus } from './provider-health-checker';

export interface StatusBadgeConfig {
  label: string;
  labelVi: string;
  color: 'gray' | 'blue' | 'green' | 'red' | 'yellow' | 'orange';
  badgeClass: string;
}

const BADGE_MAP: Record<ProviderHealthStatus, StatusBadgeConfig> = {
  NOT_CONFIGURED: {
    label: 'Not Configured',
    labelVi: 'Chưa cấu hình',
    color: 'gray',
    badgeClass: 'bg-muted text-muted-foreground border-border',
  },
  VALIDATING: {
    label: 'Validating...',
    labelVi: 'Đang kiểm tra...',
    color: 'blue',
    badgeClass: 'bg-blue-100 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800',
  },
  ACTIVE: {
    label: 'Active & Connected',
    labelVi: 'Đang hoạt động',
    color: 'green',
    badgeClass: 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
  },
  INVALID: {
    label: 'Invalid Key',
    labelVi: 'Khóa không hợp lệ',
    color: 'red',
    badgeClass: 'bg-rose-100 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800',
  },
  REVOKED: {
    label: 'Revoked',
    labelVi: 'Đã thu hồi',
    color: 'yellow',
    badgeClass: 'bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800',
  },
  PROVIDER_UNAVAILABLE: {
    label: 'Provider Offline',
    labelVi: 'Nhà cung cấp tạm gián đoạn',
    color: 'orange',
    badgeClass: 'bg-orange-100 dark:bg-orange-950/50 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-800',
  },
  UNKNOWN: {
    label: 'Unknown Status',
    labelVi: 'Trạng thái chưa xác định',
    color: 'gray',
    badgeClass: 'bg-muted text-muted-foreground border-border',
  },
};

/**
 * Returns bilingual display metadata for a health status.
 */
export function getProviderStatusBadge(
  status: ProviderHealthStatus,
  locale: 'vi' | 'en' = 'vi'
): { label: string; color: StatusBadgeConfig['color']; badgeClass: string } {
  const config = BADGE_MAP[status] ?? BADGE_MAP.UNKNOWN;
  return {
    label: locale === 'vi' ? config.labelVi : config.label,
    color: config.color,
    badgeClass: config.badgeClass,
  };
}
