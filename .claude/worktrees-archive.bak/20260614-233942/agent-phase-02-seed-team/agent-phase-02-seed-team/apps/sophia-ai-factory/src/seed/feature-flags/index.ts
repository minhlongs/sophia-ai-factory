/**
 * KV-backed percentage-rollout canary helper.
 *
 * DISTINCT from `src/lib/signals/feature-flags.ts` (PostHog A/B).
 * This module owns canary % gating; PostHog module owns A/B experimentation.
 *
 * Usage:
 *   await setFlag('new-checkout-flow', { enabled: true, percent: 10 })
 *   if (await isEnabled('new-checkout-flow', userId)) { … }
 *
 * Admin from CLI:
 *   wrangler kv key put --binding=EXPERIMENT_KV "flag:new-checkout-flow" '{"enabled":true,"percent":10}'
 *
 * Memo strategy: simple Map<string, {value,expires}> per isolate.
 * Workers isolates restart often (natural eviction). No hard cap — YAGNI.
 * If high-cardinality flags are used in future, replace with an LRU (max 1000).
 */

import { z } from 'zod'

// ---------------------------------------------------------------------------
// Types & schema
// ---------------------------------------------------------------------------

const ConfigSchema = z.object({
  enabled: z.boolean(),
  percent: z.number().int().min(0).max(100),
})

type FlagConfig = z.infer<typeof ConfigSchema>

// ---------------------------------------------------------------------------
// In-process memo (60s TTL, per Worker isolate)
// ---------------------------------------------------------------------------

const memo = new Map<string, { value: boolean; expires: number }>()
const TTL_MS = 60_000

// ---------------------------------------------------------------------------
// FNV-1a 32-bit hash (pure-JS, edge-safe, no Node crypto)
// Produces stable bucket 0..99 for a given userId string.
// ---------------------------------------------------------------------------

const FNV_OFFSET = 2166136261
const FNV_PRIME = 16777619

function fnv1aHash(input: string): number {
  let hash = FNV_OFFSET
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
    // Multiply with 32-bit overflow (>>> 0 keeps unsigned)
    hash = Math.imul(hash, FNV_PRIME) >>> 0
  }
  return hash
}

/**
 * Returns a stable bucket 0–99 for a given userId.
 * Exposed for testing and telemetry instrumentation.
 */
export function bucketFor(userId: string): number {
  return fnv1aHash(userId) % 100
}

// ---------------------------------------------------------------------------
// KV accessor (CF Workers runtime injects EXPERIMENT_KV as global binding)
// ---------------------------------------------------------------------------

function getKv(): KVNamespace | undefined {
  return (globalThis as Record<string, unknown>)['EXPERIMENT_KV'] as KVNamespace | undefined
}

// ---------------------------------------------------------------------------
// Core API
// ---------------------------------------------------------------------------

/**
 * Evaluate whether a feature flag is enabled for a given user.
 *
 * Decision rule:
 *   enabled && (percent >= 100 || (userId provided && bucket(userId) < percent))
 *
 * Defaults to false on:
 *   - KV binding absent
 *   - flag key missing
 *   - corrupt / invalid KV JSON (fail-closed)
 *   - no userId when percent < 100
 */
export async function isEnabled(flagName: string, userId?: string): Promise<boolean> {
  const memoKey = `${flagName}:${userId ?? '_anon'}`
  const cached = memo.get(memoKey)
  if (cached && cached.expires > Date.now()) return cached.value

  const kv = getKv()
  if (!kv) return false

  let value = false
  try {
    const raw = await kv.get(`flag:${flagName}`)
    if (raw) {
      const parsed = ConfigSchema.parse(JSON.parse(raw))
      if (parsed.enabled) {
        if (parsed.percent >= 100) {
          value = true
        } else if (userId) {
          value = bucketFor(userId) < parsed.percent
        }
      }
    }
  } catch {
    // corrupt KV, Zod parse error, or network — fail closed
    value = false
  }

  memo.set(memoKey, { value, expires: Date.now() + TTL_MS })
  return value
}

/**
 * Write a flag config to KV.
 *
 * ADMIN-ONLY — guard at caller layer; do not expose unauthenticated.
 * Clears in-process memo for the flag so next eval reads fresh value.
 */
export async function setFlag(flagName: string, config: FlagConfig): Promise<void> {
  const kv = getKv()
  if (!kv) throw new Error('EXPERIMENT_KV binding not available')
  // Validate before writing
  const validated = ConfigSchema.parse(config)
  await kv.put(`flag:${flagName}`, JSON.stringify(validated))
  // Invalidate memo entries for this flag
  for (const key of memo.keys()) {
    if (key.startsWith(`${flagName}:`)) memo.delete(key)
  }
}
