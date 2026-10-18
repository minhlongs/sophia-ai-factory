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
 */

import { z } from 'zod'

const ConfigSchema = z.object({
  enabled: z.boolean(),
  percent: z.number().int().min(0).max(100),
})

type FlagConfig = z.infer<typeof ConfigSchema>

const memo = new Map<string, { value: boolean; expires: number }>()
const TTL_MS = 60_000

const FNV_OFFSET = 2166136261
const FNV_PRIME = 16777619

function fnv1aHash(input: string): number {
  let hash = FNV_OFFSET
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
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

function getKv(): KVNamespace | undefined {
  return (globalThis as Record<string, unknown>)['EXPERIMENT_KV'] as KVNamespace | undefined
}

/**
 * Evaluate whether a feature flag is enabled for a given user.
 * Decision rule: enabled && (percent >= 100 || (userId provided && bucket(userId) < percent))
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
    value = false
  }

  memo.set(memoKey, { value, expires: Date.now() + TTL_MS })
  return value
}

/**
 * Write a flag config to KV (ADMIN-ONLY).
 * Clears in-process memo for the flag so next eval reads fresh value.
 */
export async function setFlag(flagName: string, config: FlagConfig): Promise<void> {
  const kv = getKv()
  if (!kv) throw new Error('EXPERIMENT_KV binding not available')
  const validated = ConfigSchema.parse(config)
  await kv.put(`flag:${flagName}`, JSON.stringify(validated))
  for (const key of memo.keys()) {
    if (key.startsWith(`${flagName}:`)) memo.delete(key)
  }
}
