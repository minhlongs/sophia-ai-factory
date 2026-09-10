/**
 * Provider Health Checker — 7-state safety machine for BYOK credentials.
 *
 * Enforces safe states preventing the "False Validation Trap".
 * Never displays raw key bytes; masks to `****...${last4}`.
 *
 * @module tree/byok/provider-health-checker
 */

export type ProviderHealthStatus =
  | 'NOT_CONFIGURED'
  | 'VALIDATING'
  | 'ACTIVE'
  | 'INVALID'
  | 'REVOKED'
  | 'PROVIDER_UNAVAILABLE'
  | 'UNKNOWN';

export interface ProviderHealthState {
  provider: string;
  status: ProviderHealthStatus;
  maskedKey: string;
  latencyMs?: number;
  lastChecked?: string;
  error?: string;
}

export interface StatusBadgeConfig {
  label: string;
  labelVi: string;
  color: 'gray' | 'blue' | 'green' | 'red' | 'yellow' | 'orange';
  badgeClass: string;
}

/**
 * Masks an API key to guarantee plain bytes never leak to UI.
 * Format: `****...${last4}` or `****` for very short keys.
 */
export function maskApiKey(key: string): string {
  const trimmed = key.trim();
  if (!trimmed) return '';
  if (trimmed.length <= 4) return '****';
  return `****...${trimmed.slice(-4)}`;
}

/**
 * Pure state resolver mapping operational signals to one of the 7 safe states.
 */
export function resolveProviderHealthStatus(params: {
  hasKey: boolean;
  isValidating?: boolean;
  isRevoked?: boolean;
  probeSuccess?: boolean;
  httpStatus?: number;
  isTimeout?: boolean;
}): ProviderHealthStatus {
  if (params.isRevoked) {
    return 'REVOKED';
  }
  if (!params.hasKey) {
    return 'NOT_CONFIGURED';
  }
  if (params.isValidating) {
    return 'VALIDATING';
  }
  if (params.probeSuccess) {
    return 'ACTIVE';
  }
  if (params.isTimeout || (params.httpStatus && params.httpStatus >= 500)) {
    return 'PROVIDER_UNAVAILABLE';
  }
  if (
    params.httpStatus === 401 ||
    params.httpStatus === 403 ||
    params.httpStatus === 422
  ) {
    return 'INVALID';
  }
  if (params.probeSuccess === false) {
    return 'INVALID';
  }
  return 'UNKNOWN';
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
