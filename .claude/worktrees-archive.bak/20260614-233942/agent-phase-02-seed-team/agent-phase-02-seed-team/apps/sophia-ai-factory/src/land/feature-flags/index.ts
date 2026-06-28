/**
 * @module feature-flags
 * KV-backed percentage-rollout canary helper.
 *
 * Flags are stored in KV as JSON: { percent: number; enabled: boolean }
 * Usage: isEnabled(flagKey, userId, env?) -> boolean
 * env is optional — reads from globalThis.EXPERIMENT_KV when omitted.
 */
import { createServerClient } from '@/seed/db/client';

export interface FeatureFlag {
  percent: number;
  enabled: boolean;
}

const KV_KEY_PREFIX = 'feature-flag:';

/** Deterministic bucket: 0-99 from userId hash (FNV-1a). */
export function bucketFor(userId: string): number {
  let h = 0;
  for (let i = 0; i < userId.length; i++) {
    h = ((h << 5) - h + userId.charCodeAt(i)) | 0;
  }
  return Math.abs(h) % 100;
}

/** Resolve KV namespace from explicit env or globalThis fallback. */
function resolveKv(env?: { EXPERIMENT_KV?: KVNamespace }): KVNamespace | undefined {
  if (env?.EXPERIMENT_KV) return env.EXPERIMENT_KV;
  return (globalThis as Record<string, unknown>)['EXPERIMENT_KV'] as KVNamespace | undefined;
}

/**
 * Returns true if the feature flag is enabled for this userId.
 * Reads from KV. Falls back to false on any error.
 * @param flagKey - The feature flag key (without prefix).
 * @param userId - The user identifier for deterministic bucket assignment. Optional for 100%-rollout flags.
 * @param env - Optional env with EXPERIMENT_KV binding. Falls back to globalThis.EXPERIMENT_KV.
 */
export async function isEnabled(
  flagKey: string,
  userId?: string,
  env?: { EXPERIMENT_KV?: KVNamespace },
): Promise<boolean> {
  const kv = resolveKv(env);
  if (!kv) return false;

  try {
    const raw = await kv.get(`${KV_KEY_PREFIX}${flagKey}`);
    if (!raw) return false;
    const flag = JSON.parse(raw) as FeatureFlag;
    if (!flag.enabled) return false;
    if (flag.percent <= 0) return false;
    if (flag.percent >= 100) return true;
    if (!userId) return false;
    return bucketFor(userId) < flag.percent;
  } catch {
    return false;
  }
}
