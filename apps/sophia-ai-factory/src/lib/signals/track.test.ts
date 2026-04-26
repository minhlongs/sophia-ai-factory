/**
 * Tests for D1 signal layer track() helper
 *
 * Covers: happy path insert, schema rejection (warn + no throw),
 * D1 failure (warn + no throw), fire-and-forget non-blocking.
 *
 * The global D1 mock is set up in src/test/setup.tsx:
 *   (globalThis).__env = { DB: d1Mock }
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { track } from './track'
import { D1Events } from './d1-event-types'

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Wait for all pending microtasks (lets fire-and-forget Promise settle) */
const flushAsync = () => new Promise<void>((r) => setTimeout(r, 0))

/** Retrieve the D1 mock from the global env set by test/setup.tsx */
function getD1Mock() {
  const env = (globalThis as unknown as Record<string, Record<string, unknown>>).__env
  return env.DB as {
    prepare: ReturnType<typeof vi.fn>
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('track()', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('inserts a row on happy path (payment_success)', async () => {
    const d1 = getD1Mock()

    track(D1Events.PAYMENT_SUCCESS, 'user-123', {
      amount_usd: 49,
      currency: 'USDT',
      provider: 'nowpayments',
      payment_id: 'pay-abc',
    })

    await flushAsync()

    expect(d1.prepare).toHaveBeenCalledOnce()
    expect(d1.prepare).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO signals_events'),
    )

    const bindMock = d1.prepare.mock.results[0].value.bind
    expect(bindMock).toHaveBeenCalledWith(
      expect.any(Number),          // ts
      D1Events.PAYMENT_SUCCESS,    // event_type
      'user-123',                  // actor
      null,                        // org_id (no orgId passed)
      expect.stringContaining('"provider":"nowpayments"'), // props_json
    )
  })

  it('logs warn and does NOT throw when props fail Zod schema', async () => {
    const warnSpy = vi.spyOn(console, 'warn')
    const d1 = getD1Mock()

    // Missing required fields for payment_success
    track(D1Events.PAYMENT_SUCCESS, 'user-123', { invalid_field: true })

    await flushAsync()

    // D1 prepare should NOT be called — rejected before insert
    expect(d1.prepare).not.toHaveBeenCalled()
    expect(warnSpy).toHaveBeenCalled()
  })

  it('logs warn and does NOT throw when D1 run() rejects', async () => {
    const warnSpy = vi.spyOn(console, 'warn')
    const d1 = getD1Mock()

    // Override run() to simulate D1 failure
    d1.prepare.mockReturnValueOnce({
      bind: vi.fn().mockReturnValue({
        run: vi.fn().mockRejectedValue(new Error('D1_FAIL')),
      }),
    })

    track(D1Events.AGENT_DISPATCH, 'system', {
      campaign_id: 'camp-1',
      channel_count: 2,
    })

    await flushAsync()

    expect(warnSpy).toHaveBeenCalled()
  })

  it('is fire-and-forget — returns void synchronously before D1 completes', async () => {
    // track() must return before the D1 prepare resolves
    let d1Resolved = false
    const d1 = getD1Mock()

    d1.prepare.mockReturnValueOnce({
      bind: vi.fn().mockReturnValue({
        run: vi.fn().mockImplementation(async () => {
          await new Promise<void>((r) => setTimeout(r, 50))
          d1Resolved = true
          return { success: true, meta: {} }
        }),
      }),
    })

    // Call track — must not await anything
    track(D1Events.BYOK_CALL, 'system', {
      provider: 'elevenlabs',
      status_code: 200,
      latency_ms: 120,
    })

    // Immediately after — D1 has NOT resolved yet
    expect(d1Resolved).toBe(false)

    // Let the async work complete
    await new Promise<void>((r) => setTimeout(r, 100))
    expect(d1Resolved).toBe(true)
  })

  it('stores orgId when provided', async () => {
    const d1 = getD1Mock()

    track(
      D1Events.TIER_CONVERSION,
      'user-456',
      { from_tier: 'BASIC', to_tier: 'PREMIUM', amount_usd: 49, provider: 'nowpayments' },
      'org-xyz',
    )

    await flushAsync()

    const bindMock = d1.prepare.mock.results[0].value.bind
    expect(bindMock).toHaveBeenCalledWith(
      expect.any(Number),
      D1Events.TIER_CONVERSION,
      'user-456',
      'org-xyz',
      expect.any(String),
    )
  })
})
