/**
 * Cloudflare KV Storage Adapter for Circuit Breaker
 *
 * Layer: seed/utils/circuit-breaker
 */

import {
  type AttemptEntry,
  type KvCircuitData,
  KV_LOG_KEY,
  KV_STATE_KEY,
  WINDOW_MS,
} from './types';

/**
 * Get Cloudflare KV namespace (EXPERIMENT_KV).
 * Returns null in local dev where CF bindings are unavailable.
 */
export async function getKv(): Promise<KVNamespace | null> {
  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare');
    const ctx = await getCloudflareContext();
    const env = ctx.env as Record<string, unknown>;
    return (env.EXPERIMENT_KV as KVNamespace) ?? null;
  } catch {
    return null;
  }
}

export async function readLog(kv: KVNamespace): Promise<AttemptEntry[]> {
  try {
    const raw = await kv.get(KV_LOG_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as AttemptEntry[];
  } catch {
    return [];
  }
}

export async function readState(kv: KVNamespace): Promise<KvCircuitData> {
  try {
    const raw = await kv.get(KV_STATE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as KvCircuitData;
  } catch {
    return {};
  }
}

export function filterWindow(entries: AttemptEntry[]): AttemptEntry[] {
  const cutoff = Date.now() - WINDOW_MS;
  return entries.filter((e) => e.ts >= cutoff);
}
