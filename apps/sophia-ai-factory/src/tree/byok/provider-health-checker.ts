/**
 * Provider Health Checker — 7-state safety machine for BYOK credentials.
 *
 * Enforces safe states preventing the "False Validation Trap".
 * Never displays raw key bytes; masks to `****...${last4}`.
 *
 * @module tree/byok/provider-health-checker
 */

import {
  getProviderStatusBadge,
  type StatusBadgeConfig,
} from './provider-status-badges';

export { getProviderStatusBadge, type StatusBadgeConfig };

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
