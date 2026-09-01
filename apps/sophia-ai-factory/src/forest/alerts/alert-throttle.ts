/**
 * Alert Throttle — KV-based duplicate-suppression for platform alerts.
 *
 * Layer: forest. Imports seed only.
 * Reuses the EXISTING EXPERIMENT_KV binding (no new KV namespace).
 * Prevents alert storms: 1 alert per throttle key per TTL window.
 * Absence of the KV binding degrades to unthrottled dispatch (alert still
 * fires — observability must never be silently lost, and the user_alerts
 * dedup constraint is per-run so an occasional duplicate is acceptable).
 *
 * @module forest/alerts/alert-throttle
 */

type WorkersKVNamespace = import('@cloudflare/workers-types').KVNamespace;

/** Resolve EXPERIMENT_KV binding from CF Workers env. */
export function getAlertThrottleKv(): WorkersKVNamespace | null {
  try {
    const g = globalThis as Record<string, unknown>;
    if (g.EXPERIMENT_KV && typeof (g.EXPERIMENT_KV as WorkersKVNamespace).get === 'function') {
      return g.EXPERIMENT_KV as WorkersKVNamespace;
    }
    const envDouble = (globalThis as unknown as Record<string, Record<string, unknown>>).__env__;
    if (envDouble?.EXPERIMENT_KV) return envDouble.EXPERIMENT_KV as WorkersKVNamespace;
    const envSingle = (globalThis as unknown as Record<string, Record<string, unknown>>).__env;
    if (envSingle?.EXPERIMENT_KV) return envSingle.EXPERIMENT_KV as WorkersKVNamespace;
    return null;
  } catch {
    return null;
  }
}

/**
 * Returns true when a recent alert for this key is still inside the TTL
 * window (duplicate suppressed). KV-unavailable → false (never suppress
 * on infrastructure uncertainty).
 */
export async function isAlertThrottled(key: string): Promise<boolean> {
  const kv = getAlertThrottleKv();
  if (!kv) return false;
  try {
    const existing = await kv.get(key);
    return existing !== null && existing !== undefined && existing !== '';
  } catch {
    return false;
  }
}

/**
 * Record that an alert fired for this key, expiring after ttlSeconds.
 * Failure to mark is non-fatal (worst case: an extra duplicate next run).
 */
export async function markAlertThrottled(
  key: string,
  value: string,
  ttlSeconds: number,
): Promise<void> {
  const kv = getAlertThrottleKv();
  if (!kv) return;
  try {
    await kv.put(key, value, { expirationTtl: Math.max(60, ttlSeconds) });
  } catch {
    // Non-fatal — duplicate suppression is best-effort.
  }
}
