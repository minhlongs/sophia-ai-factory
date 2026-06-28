/**
 * Unit tests for HeyGen circuit breaker.
 *
 * Covers:
 *  - KV unavailable (local dev) → always allow
 *  - Happy path: closed → open after failures → half-open after 5 min → closed
 *  - Re-open when half-open probe fails
 *  - shouldDispatch logic per state
 *  - resetCircuit
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mock KV store ──────────────────────────────────────────────────────────────

const kvStore: Record<string, string> = {}

const mockKv: KVNamespace = {
  get: vi.fn(async (key: string) => kvStore[key] ?? null),
  put: vi.fn(async (key: string, value: string) => { kvStore[key] = value }),
  delete: vi.fn(async (key: string) => { delete kvStore[key] }),
  list: vi.fn(async () => ({ keys: [], list_complete: true, cursor: '' })),
  getWithMetadata: vi.fn(),
} as unknown as KVNamespace

// ── Mock @opennextjs/cloudflare ────────────────────────────────────────────────

vi.mock('@opennextjs/cloudflare', () => ({
  getCloudflareContext: vi.fn(async () => ({
    env: { EXPERIMENT_KV: mockKv },
  })),
}))

// Mock slack-alert to avoid HTTP calls
vi.mock('@/land/monitoring/slack-alert', () => ({
  sendSlackAlert: vi.fn(async () => undefined),
}))

import {
  recordHeyGenAttempt,
  getCircuitState,
  shouldDispatch,
  resetCircuit,
} from '@/seed/utils/circuit-breaker'

// Helper: fill log with N failure entries within the 10-min window
async function fillFailures(count: number): Promise<void> {
  for (let i = 0; i < count; i++) {
    await recordHeyGenAttempt(false)
  }
}

async function fillSuccesses(count: number): Promise<void> {
  for (let i = 0; i < count; i++) {
    await recordHeyGenAttempt(true)
  }
}

describe('circuit-breaker', () => {
  beforeEach(async () => {
    // Clear KV store between tests
    for (const k of Object.keys(kvStore)) delete kvStore[k]
    vi.clearAllMocks()
  })

  describe('KV unavailable', () => {
    it('always allows dispatch when KV is null', async () => {
      vi.mocked((await import('@opennextjs/cloudflare')).getCloudflareContext).mockRejectedValueOnce(
        new Error('No CF context'),
      )
      const decision = await shouldDispatch()
      expect(decision.allowed).toBe(true)
    })
  })

  describe('closed state', () => {
    it('starts closed and allows dispatch', async () => {
      const status = await getCircuitState()
      expect(status.state).toBe('closed')

      const d = await shouldDispatch()
      expect(d.allowed).toBe(true)
    })

    it('does not open with fewer than 10 attempts', async () => {
      await fillFailures(9)
      const status = await getCircuitState()
      expect(status.state).toBe('closed')
    })

    it('stays closed when failure rate <=50%', async () => {
      await fillSuccesses(5)
      await fillFailures(5) // 50% — not > threshold
      const status = await getCircuitState()
      expect(status.state).toBe('closed')
    })
  })

  describe('closed → open transition', () => {
    it('opens when failure rate >50% with >=10 attempts', async () => {
      await fillSuccesses(4)
      await fillFailures(6) // 60% failure rate with 10 attempts
      const status = await getCircuitState()
      expect(status.state).toBe('open')
      expect(status.recentFailures).toBe(6)
      expect(status.recentSuccesses).toBe(4)
    })

    it('blocks dispatch when open', async () => {
      await fillSuccesses(4)
      await fillFailures(6)
      const d = await shouldDispatch()
      expect(d.allowed).toBe(false)
      expect(d.reason).toMatch(/circuit_open/)
    })
  })

  describe('open → half-open transition', () => {
    it('transitions to half-open after 5 min (mock time)', async () => {
      // Open circuit first
      await fillSuccesses(4)
      await fillFailures(6)

      // Fast-forward: set openedAt to 6 minutes ago
      const kvStateKey = 'circuit:heygen'
      kvStore[kvStateKey] = JSON.stringify({ openedAt: Date.now() - 6 * 60 * 1000, halfOpenProbeAllowed: false })

      const status = await getCircuitState()
      expect(status.state).toBe('half-open')
    })

    it('allows exactly one probe when half-open', async () => {
      kvStore['circuit:heygen'] = JSON.stringify({
        openedAt: Date.now() - 6 * 60 * 1000,
        halfOpenProbeAllowed: true,
      })

      const d1 = await shouldDispatch()
      expect(d1.allowed).toBe(true)
      expect(d1.reason).toBe('half_open_probe')

      // Second call: probe slot consumed, halfOpenProbeAllowed=false now
      const d2 = await shouldDispatch()
      expect(d2.allowed).toBe(false)
      expect(d2.reason).toBe('half_open_probe_pending')
    })
  })

  describe('half-open probe results', () => {
    it('closes circuit on successful probe', async () => {
      // Set state as half-open probe in flight (halfOpenProbeAllowed=false)
      kvStore['circuit:heygen'] = JSON.stringify({
        openedAt: Date.now() - 6 * 60 * 1000,
        halfOpenProbeAllowed: false,
      })

      await recordHeyGenAttempt(true)

      // State key should be cleared
      expect(kvStore['circuit:heygen']).toBeUndefined()
      const status = await getCircuitState()
      expect(status.state).toBe('closed')
    })

    it('re-opens circuit on failed probe', async () => {
      kvStore['circuit:heygen'] = JSON.stringify({
        openedAt: Date.now() - 6 * 60 * 1000,
        halfOpenProbeAllowed: false,
      })

      await recordHeyGenAttempt(false)

      const status = await getCircuitState()
      expect(status.state).toBe('open')
    })
  })

  describe('resetCircuit', () => {
    it('clears all state and returns closed', async () => {
      // Open circuit
      await fillSuccesses(4)
      await fillFailures(6)
      expect((await getCircuitState()).state).toBe('open')

      const result = await resetCircuit()
      expect(result.state).toBe('closed')
      expect(result.recentFailures).toBe(0)

      const status = await getCircuitState()
      expect(status.state).toBe('closed')
    })
  })
})
