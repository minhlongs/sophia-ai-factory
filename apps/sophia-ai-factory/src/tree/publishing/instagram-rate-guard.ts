/**
 * SEC-05: Instagram Graph API Business Use Case (BUC) Rate-Limit Header Guard
 *
 * Parses `x-business-use-case-usage` / `x-app-usage` headers and throttles
 * outbound publishing jobs when `call_count`, `total_cputime`, or `total_time`
 * exceeds 80% utilization.
 *
 * Layer: tree (domain reusable logic)
 * @module tree/publishing/instagram-rate-guard
 */

export const INSTAGRAM_BUC_THROTTLE_THRESHOLD = 80;

export interface InstagramUsageSnapshot {
  readonly callCount: number;
  readonly totalCpuTime: number;
  readonly totalTime: number;
  readonly estimatedTimeToRegainAccess: number;
}

export interface InstagramThrottleDecision {
  readonly shouldThrottle: boolean;
  readonly maxUtilizationPct: number;
  readonly recommendedBackoffSec: number;
  readonly snapshot: InstagramUsageSnapshot;
}

interface RawUsageEntry {
  call_count?: unknown;
  total_cputime?: unknown;
  total_time?: unknown;
  estimated_time_to_regain_access?: unknown;
}

function normalizeUsageEntry(entry: RawUsageEntry): InstagramUsageSnapshot {
  return {
    callCount: Math.max(0, Number(entry.call_count) || 0),
    totalCpuTime: Math.max(0, Number(entry.total_cputime) || 0),
    totalTime: Math.max(0, Number(entry.total_time) || 0),
    estimatedTimeToRegainAccess: Math.max(0, Number(entry.estimated_time_to_regain_access) || 0),
  };
}

/**
 * Parses Meta `x-business-use-case-usage` (keyed by business object ID to array of entries)
 * or `x-app-usage` (flat object) JSON header into the highest-utilization snapshot.
 */
export function parseInstagramBucHeader(headerValue: string | null | undefined): InstagramUsageSnapshot {
  const empty: InstagramUsageSnapshot = {
    callCount: 0,
    totalCpuTime: 0,
    totalTime: 0,
    estimatedTimeToRegainAccess: 0,
  };
  if (!headerValue || typeof headerValue !== 'string') return empty;

  try {
    const parsed = JSON.parse(headerValue) as unknown;
    if (!parsed || typeof parsed !== 'object') return empty;

    const candidates: InstagramUsageSnapshot[] = [];
    const record = parsed as Record<string, unknown>;

    if (
      'call_count' in record ||
      'total_cputime' in record ||
      'total_time' in record
    ) {
      candidates.push(normalizeUsageEntry(record as RawUsageEntry));
    } else {
      for (const val of Object.values(record)) {
        if (Array.isArray(val)) {
          for (const item of val) {
            if (item && typeof item === 'object') {
              candidates.push(normalizeUsageEntry(item as RawUsageEntry));
            }
          }
        }
      }
    }

    if (candidates.length === 0) return empty;
    return candidates.reduce((best, curr) => {
      const bestMax = Math.max(best.callCount, best.totalCpuTime, best.totalTime);
      const currMax = Math.max(curr.callCount, curr.totalCpuTime, curr.totalTime);
      return currMax > bestMax ? curr : best;
    });
  } catch {
    return empty;
  }
}

/**
 * Evaluates whether Instagram publishing should pause/throttle based on the
 * >80% BUC utilization threshold (SEC-05).
 */
export function shouldThrottleInstagramPublish(
  headerValue: string | null | undefined,
  thresholdPct: number = INSTAGRAM_BUC_THROTTLE_THRESHOLD,
): InstagramThrottleDecision {
  const snapshot = parseInstagramBucHeader(headerValue);
  const maxUtilizationPct = Math.max(
    snapshot.callCount,
    snapshot.totalCpuTime,
    snapshot.totalTime,
  );
  const shouldThrottle =
    maxUtilizationPct > thresholdPct || snapshot.estimatedTimeToRegainAccess > 0;
  const recommendedBackoffSec = shouldThrottle
    ? Math.max(300, snapshot.estimatedTimeToRegainAccess * 60 || 900)
    : 0;

  return {
    shouldThrottle,
    maxUtilizationPct,
    recommendedBackoffSec,
    snapshot,
  };
}
