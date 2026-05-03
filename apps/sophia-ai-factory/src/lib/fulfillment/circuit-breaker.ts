/**
 * HeyGen Circuit Breaker — KV-backed failure rate tracking.
 *
 * State machine:
 *   closed    → all attempts allowed
 *   open      → block new dispatches; auto-transitions to half-open after 5 min
 *   half-open → allow exactly 1 probe attempt; success → closed, fail → open
 *
 * State persisted in EXPERIMENT_KV under key `circuit:heygen`.
 * Attempt log (last 50 entries) stored under `circuit:heygen:log`.
 *
 * Threshold: failure rate >50% with >=10 attempts in last 10 min → open.
 *
 * @module lib/fulfillment/circuit-breaker
 */

import { logger } from '@/seed/utils/logger-utility'
import { sendSlackAlert } from '@/lib/monitoring/slack-alert'

export type CircuitState = 'closed' | 'open' | 'half-open'

export interface CircuitStatus {
  state: CircuitState
  openedAt?: number
  recentFailures: number
  recentSuccesses: number
}

export interface DispatchDecision {
  allowed: boolean
  reason?: string
}

interface AttemptEntry {
  ts: number
  ok: boolean
}

interface KvCircuitData {
  openedAt?: number
  halfOpenProbeAllowed?: boolean
}

const KV_STATE_KEY = 'circuit:heygen'
const KV_LOG_KEY = 'circuit:heygen:log'
const MAX_LOG_ENTRIES = 50
const WINDOW_MS = 10 * 60 * 1000         // 10 minutes
const FAILURE_RATE_THRESHOLD = 0.5       // 50%
const MIN_ATTEMPTS_TO_OPEN = 10
const HALF_OPEN_TIMEOUT_MS = 5 * 60 * 1000  // 5 minutes
const KV_TTL_SECONDS = 2 * 60 * 60      // 2h data retention

/**
 * Get Cloudflare KV namespace (EXPERIMENT_KV).
 * Returns null in local dev where CF bindings are unavailable.
 */
async function getKv(): Promise<KVNamespace | null> {
  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare')
    const ctx = await getCloudflareContext()
    const env = ctx.env as Record<string, unknown>
    return (env.EXPERIMENT_KV as KVNamespace) ?? null
  } catch {
    return null
  }
}

async function readLog(kv: KVNamespace): Promise<AttemptEntry[]> {
  try {
    const raw = await kv.get(KV_LOG_KEY)
    if (!raw) return []
    return JSON.parse(raw) as AttemptEntry[]
  } catch {
    return []
  }
}

async function readState(kv: KVNamespace): Promise<KvCircuitData> {
  try {
    const raw = await kv.get(KV_STATE_KEY)
    if (!raw) return {}
    return JSON.parse(raw) as KvCircuitData
  } catch {
    return {}
  }
}

function filterWindow(entries: AttemptEntry[]): AttemptEntry[] {
  const cutoff = Date.now() - WINDOW_MS
  return entries.filter((e) => e.ts >= cutoff)
}

/**
 * Record a HeyGen attempt result (success or failure).
 * Updates the rolling log and may transition circuit state.
 */
export async function recordHeyGenAttempt(success: boolean): Promise<void> {
  const kv = await getKv()
  if (!kv) return

  const [log, state] = await Promise.all([readLog(kv), readState(kv)])

  const entry: AttemptEntry = { ts: Date.now(), ok: success }
  const updated = [...log, entry].slice(-MAX_LOG_ENTRIES)

  await kv.put(KV_LOG_KEY, JSON.stringify(updated), { expirationTtl: KV_TTL_SECONDS })

  // If we are in half-open and just got a result (probe slot consumed = false), resolve the probe
  if (state.openedAt !== undefined && state.halfOpenProbeAllowed === false) {
    if (success) {
      // Probe succeeded → close circuit
      await kv.delete(KV_STATE_KEY)
      logger.info('[CircuitBreaker] Half-open probe succeeded — circuit closed')
    } else {
      // Probe failed → re-open with fresh timestamp (no halfOpenProbeAllowed key = will re-grant after 5min)
      const newState: KvCircuitData = { openedAt: Date.now() }
      await kv.put(KV_STATE_KEY, JSON.stringify(newState), { expirationTtl: KV_TTL_SECONDS })
      logger.warn('[CircuitBreaker] Half-open probe failed — circuit re-opened')
    }
    return
  }

  // Check if we should open the circuit (only when currently closed — edge detection)
  if (state.openedAt === undefined) {
    const recent = filterWindow(updated)
    if (recent.length >= MIN_ATTEMPTS_TO_OPEN) {
      const failures = recent.filter((e) => !e.ok).length
      const rate = failures / recent.length
      if (rate > FAILURE_RATE_THRESHOLD) {
        const openedAt = Date.now()
        // Open: no halfOpenProbeAllowed key — will be granted after HALF_OPEN_TIMEOUT_MS
        const newState: KvCircuitData = { openedAt }
        await kv.put(KV_STATE_KEY, JSON.stringify(newState), { expirationTtl: KV_TTL_SECONDS })
        logger.error('[CircuitBreaker] Circuit OPENED — HeyGen failure rate exceeded threshold', undefined, {
          failures,
          total: recent.length,
          rate: rate.toFixed(2),
        })
        sendSlackAlert('high', `HeyGen circuit breaker OPENED — failure rate ${(rate * 100).toFixed(0)}%`, {
          failures,
          total: recent.length,
          windowMinutes: WINDOW_MS / 60000,
        }).catch(() => {})

        // F9-lite: fire customer comms on closed→open edge (waitUntil if available)
        // Skip in test env to avoid dynamic import side effects in unit tests
        if (process.env.NODE_ENV !== 'test' && process.env.VITEST !== 'true') {
          try {
            fireOutageComms(openedAt)
          } catch {
            // Never throw out of recordHeyGenAttempt
          }
        }
      }
    }
  }
}

/**
 * Fire outage customer notifications fire-and-forget.
 * Uses executionCtx.waitUntil when available (Cloudflare Workers),
 * falls back to untracked promise otherwise (local dev).
 * Dynamic import avoids circular dependency with circuit-breaker-comms.
 */
function fireOutageComms(openedAt: number): void {
  const work = import('@/lib/fulfillment/circuit-breaker-comms').then(
    ({ notifyCustomersOnOutage }) => notifyCustomersOnOutage(openedAt),
  ).catch((err) => {
    logger.error('[CircuitBreaker] fireOutageComms failed', err instanceof Error ? err : undefined)
  })

  // Use waitUntil when available to ensure CF Workers runs to completion
  import('@opennextjs/cloudflare')
    .then(({ getCloudflareContext }) => getCloudflareContext())
    .then((cfCtx) => {
      const ctx = cfCtx as { ctx?: { waitUntil?: (p: Promise<unknown>) => void } }
      if (ctx.ctx?.waitUntil) {
        ctx.ctx.waitUntil(work)
      }
    })
    .catch(() => {
      // No CF context (local dev) — work is already fire-and-forget via Promise
    })
}

/**
 * Get current circuit state with recent window stats.
 */
export async function getCircuitState(): Promise<CircuitStatus> {
  const kv = await getKv()
  if (!kv) {
    return { state: 'closed', recentFailures: 0, recentSuccesses: 0 }
  }

  const [log, state] = await Promise.all([readLog(kv), readState(kv)])
  const recent = filterWindow(log)
  const recentFailures = recent.filter((e) => !e.ok).length
  const recentSuccesses = recent.filter((e) => e.ok).length

  if (state.openedAt === undefined) {
    return { state: 'closed', recentFailures, recentSuccesses }
  }

  const ageMs = Date.now() - state.openedAt
  if (ageMs >= HALF_OPEN_TIMEOUT_MS) {
    // Time to probe — grant probe slot only on first transition (not if already consumed)
    if (state.halfOpenProbeAllowed === undefined) {
      // First time we've noticed the timeout — grant one probe slot
      const next: KvCircuitData = { openedAt: state.openedAt, halfOpenProbeAllowed: true }
      await kv.put(KV_STATE_KEY, JSON.stringify(next), { expirationTtl: KV_TTL_SECONDS })
    }
    return { state: 'half-open', openedAt: state.openedAt, recentFailures, recentSuccesses }
  }

  return { state: 'open', openedAt: state.openedAt, recentFailures, recentSuccesses }
}

/**
 * Decide whether to allow a new HeyGen dispatch.
 * Returns { allowed: true } when circuit is closed or half-open probe slot available.
 */
export async function shouldDispatch(): Promise<DispatchDecision> {
  const kv = await getKv()
  if (!kv) {
    // KV unavailable (local dev) — allow all
    return { allowed: true }
  }

  const status = await getCircuitState()

  if (status.state === 'closed') {
    return { allowed: true }
  }

  if (status.state === 'half-open') {
    // Consume the probe slot
    const state = await readState(kv)
    if (state.halfOpenProbeAllowed) {
      // Mark probe as consumed
      const consumed: KvCircuitData = { openedAt: state.openedAt, halfOpenProbeAllowed: false }
      await kv.put(KV_STATE_KEY, JSON.stringify(consumed), { expirationTtl: KV_TTL_SECONDS })
      return { allowed: true, reason: 'half_open_probe' }
    }
    // Probe already consumed — block
    return { allowed: false, reason: 'half_open_probe_pending' }
  }

  // Circuit is open
  return {
    allowed: false,
    reason: `circuit_open since ${new Date(status.openedAt!).toISOString()}`,
  }
}

/**
 * Admin-only: clear circuit breaker state and log. Returns new status.
 */
export async function resetCircuit(): Promise<CircuitStatus> {
  const kv = await getKv()
  if (kv) {
    await Promise.all([
      kv.delete(KV_STATE_KEY),
      kv.delete(KV_LOG_KEY),
    ])
    logger.info('[CircuitBreaker] Circuit manually reset by admin')
  }
  return { state: 'closed', recentFailures: 0, recentSuccesses: 0 }
}
