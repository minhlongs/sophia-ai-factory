/**
 * Sentry SSE Breadcrumb Sampler (Wave-15)
 *
 * Rationale: SSE streams emit high-frequency events; sampling prevents Sentry
 * breadcrumb quota exhaustion while preserving signal for errors and first events.
 *
 * Policy:
 * - Always pass: category='error', first event per mission (tracked per second bucket)
 * - Drop: > MAX_SSE_PER_SECOND SSE breadcrumbs in the same 1-second bucket per mission
 *
 * Layer: seed/observability/sentry
 */

// First event per 1-second window per mission always passes; events 2..10 sampled at 10%
// (1-in-10); events 11+ in the same window are dropped. Errors always bypass sampling.
export const SSE_SAMPLE_RATE = 0.1;
export const MAX_SSE_PER_SECOND = 10; // absolute cap per mission per second

interface SseBucket {
  count: number;
  windowStart: number; // unix seconds
}

// Module-level counter: missionId → bucket. Cleared when window advances.
const sseMissionBuckets = new Map<string, SseBucket>();

/**
 * Deterministic SSE breadcrumb sampler.
 * Returns true (keep) or false (drop).
 */
export function shouldKeepSseBreadcrumb(
  data: Record<string, unknown> | undefined,
  level?: string,
): boolean {
  // Always keep error-level SSE breadcrumbs
  if (level === 'error') return true;

  const missionId = typeof data?.mission_id === 'string' ? data.mission_id : '__global__';
  const nowSec = Math.floor(Date.now() / 1000);

  const bucket = sseMissionBuckets.get(missionId);
  if (!bucket || bucket.windowStart !== nowSec) {
    // New window — always keep the first event
    sseMissionBuckets.set(missionId, { count: 1, windowStart: nowSec });
    return true;
  }

  bucket.count += 1;

  // Hard cap
  if (bucket.count > MAX_SSE_PER_SECOND) return false;

  // Probabilistic sample for events 2..MAX_SSE_PER_SECOND
  return Math.random() < SSE_SAMPLE_RATE;
}
