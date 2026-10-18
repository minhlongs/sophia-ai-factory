/**
 * Platform audience metrics fetcher — BYOK tokens, circuit breaker on every
 * external HTTP call, failure-kind classification on every failure.
 *
 * Layer: tree (domain-reusable). Imports seed only.
 * Doctrine: tokens are customer-owned (publishing_channels); no operator
 * credentials exist in this module.
 *
 * @module tree/audience/metrics-fetcher
 */

import { shouldAllowRequest, recordFailure, recordSuccess } from '@/seed/security/circuit-breaker';
import { classifyError } from '@/seed/types/failure-kind';
import { success, failure, type Result } from '@/seed/types/result';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import { fetchByPlatform } from './platform-metrics-adapters';
import type { AudiencePlatform, Demographics, PlatformMetricsSnapshot } from './types';

export interface FetchMetricsError {
  code: 'CIRCUIT_OPEN' | 'FETCH_FAILED' | 'INVALID_RESPONSE';
  message: string;
}

/** Fetch audience metrics for one platform using the customer's BYOK token. */
export async function fetchPlatformMetrics(
  platform: AudiencePlatform,
  accessToken: string,
): Promise<Result<PlatformMetricsSnapshot, FetchMetricsError>> {
  if (!shouldAllowRequest(`audience-${platform}`)) {
    logger.warn('[metrics-fetcher] Circuit open, skipping', { platform });
    return failure({ code: 'CIRCUIT_OPEN', message: `Circuit breaker open for ${platform}` });
  }

  try {
    const snapshot = await fetchByPlatform(platform, accessToken);
    recordSuccess(`audience-${platform}`);
    return success(snapshot);
  } catch (err) {
    const kind = classifyError(err);
    recordFailure(`audience-${platform}`, kind);
    logger.error('[metrics-fetcher] Fetch failed', toError(err), { platform, kind });
    return failure({ code: 'FETCH_FAILED', message: toError(err).message });
  }
}

function parseShare(value: unknown): number | undefined {
  return typeof value === 'number' && value >= 0 && value <= 1 ? value : undefined;
}

/** Merge raw demographics into a snapshot (values must be shares in [0,1]). */
export function withDemographics(
  snapshot: PlatformMetricsSnapshot,
  demographics: Demographics,
): PlatformMetricsSnapshot {
  const cleaned: Demographics = {};
  if (demographics.ageBuckets) {
    cleaned.ageBuckets = Object.fromEntries(
      Object.entries(demographics.ageBuckets).filter(([, v]) => parseShare(v) !== undefined),
    );
  }
  if (demographics.countries) {
    cleaned.countries = Object.fromEntries(
      Object.entries(demographics.countries).filter(([, v]) => parseShare(v) !== undefined),
    );
  }
  if (demographics.genders) {
    cleaned.genders = Object.fromEntries(
      Object.entries(demographics.genders).filter(([, v]) => parseShare(v) !== undefined),
    );
  }
  return { ...snapshot, demographics: cleaned };
}
