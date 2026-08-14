/**
 * Signals loop mitigation tests (RED-TEAM #3, #9, #11)
 * Covers:
 *  (a) client capture of server-only event THROWS
 *  (b) requireAuth rejects unauthenticated request
 *  (c) requireAuth accepts valid CRON_SECRET bearer
 *  (d) requireAuth accepts valid Better Auth session
 *  (e) feature flag KV cache hit avoids /decide/ fetch call
 *  (f) NOWPayments webhook emits tier_upgraded on 'finished' IPN
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---- (a) + RED-TEAM #11: client capture of server-only event throws ----
describe('posthog-capture: server-only trust boundary', () => {
  beforeEach(() => {
    vi.stubEnv('POSTHOG_PROJECT_KEY', 'test-key')
  })

  it('(a) throws when client source emits server-only event', async () => {
    const { captureServer } = await import('./posthog-capture')
    await expect(
      captureServer({ event: 'tier_upgraded', distinctId: 'u1', source: 'client' }),
    ).rejects.toThrow(/server-only/)
  })

  it('allows client source for non-financial events', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetchMock)
    const { captureServer } = await import('./posthog-capture')
    await expect(
      captureServer({ event: 'pageview', distinctId: 'u1', source: 'client', properties: { path: '/home' } }),
    ).resolves.toBeUndefined()
    vi.unstubAllGlobals()
  })

  it('allows server source for server-only events', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetchMock)
    const { captureServer } = await import('./posthog-capture')
    await expect(
      captureServer({ event: 'tier_upgraded', distinctId: 'u1', source: 'server', properties: { tier: 'premium', amount: 99, currency: 'USD' } }),
    ).resolves.toBeUndefined()
    vi.unstubAllGlobals()
  })
})

// ---- (b)(c)(d) + RED-TEAM #3: auth-helper ----
describe('auth-helper: requireAuth', () => {
  beforeEach(() => {
    vi.stubEnv('CRON_SECRET', 'test-cron-secret-abc')
  })

  it('(b) rejects unauthenticated request → 401', async () => {
    // No bearer, no session → 401
    const sessionModule = await import('@/seed/auth/better-auth-session')
    const spy = vi.spyOn(sessionModule, 'getCurrentUserFromHeaders').mockResolvedValue(null)

    const { requireAuth } = await import('./auth-helper')
    const req = new Request('https://sophia.agencyos.network/api/signals/track') as unknown as import('next/server').NextRequest
    const result = await requireAuth(req)
    expect(result).toBeInstanceOf(Response)
    expect((result as Response).status).toBe(401)

    spy.mockRestore()
  }, 10000)

  it('(c) accepts valid CRON_SECRET bearer', async () => {
    const { requireAuth } = await import('./auth-helper')
    const req = new Request('https://sophia.agencyos.network/api/signals/track', {
      headers: { Authorization: 'Bearer test-cron-secret-abc' },
    }) as unknown as import('next/server').NextRequest
    const result = await requireAuth(req)
    expect(result).toEqual({ type: 'cron' })
  })

  it('(d) accepts valid Better Auth session via direct requireAuth logic', async () => {
    // Test the session branch directly by calling requireAuth with no bearer
    // and injecting a real-like session via spying on getCurrentUserFromHeaders
    const sessionModule = await import('@/seed/auth/better-auth-session')
    const spy = vi.spyOn(sessionModule, 'getCurrentUserFromHeaders').mockResolvedValue({
      id: 'user-123',
      email: 'test@example.com',
      full_name: 'Test User',
      avatar_url: undefined,
      role: 'user',
    })

    // Re-import to pick up spy (same module instance is fine since we spy)
    const { requireAuth } = await import('./auth-helper')
    const req = new Request('https://sophia.agencyos.network/api/signals/track') as unknown as import('next/server').NextRequest
    const result = await requireAuth(req)
    expect(result).toEqual({ type: 'session', userId: 'user-123' })

    spy.mockRestore()
  })

  it('rejects wrong bearer token → 401', async () => {
    const { requireAuth } = await import('./auth-helper')
    const req = new Request('https://sophia.agencyos.network/api/signals/track', {
      headers: { Authorization: 'Bearer wrong-secret' },
    }) as unknown as import('next/server').NextRequest
    const result = await requireAuth(req)
    expect(result).toBeInstanceOf(Response)
    expect((result as Response).status).toBe(401)
  })
})

// ---- (e) + RED-TEAM #9: feature flag KV cache ----
describe('feature-flags: KV cache prevents extra /decide/ calls', () => {
  it('(e) KV cache hit skips PostHog /decide/ fetch', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    // Inject mock KV with cached value
    const mockKv = {
      get: vi.fn().mockResolvedValue(JSON.stringify('treatment')),
      put: vi.fn().mockResolvedValue(undefined),
    }
    ;(globalThis as Record<string, unknown>)['EXPERIMENT_KV'] = mockKv

    vi.stubEnv('POSTHOG_PROJECT_KEY', 'test-key')
    const { flag } = await import('./feature-flags')
    const result = await flag('my-experiment', 'user-abc')

    expect(result).toBe('treatment')
    expect(fetchMock).not.toHaveBeenCalled() // no PostHog call
    expect(mockKv.get).toHaveBeenCalledWith('flag:my-experiment:user-abc')

    delete (globalThis as Record<string, unknown>)['EXPERIMENT_KV']
    vi.unstubAllGlobals()
  })

  it('KV cache miss triggers PostHog /decide/ and caches result', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ featureFlags: { 'my-experiment': 'control' } }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const putMock = vi.fn().mockResolvedValue(undefined)
    const mockKv = {
      get: vi.fn().mockResolvedValue(null), // cache miss
      put: putMock,
    }
    ;(globalThis as Record<string, unknown>)['EXPERIMENT_KV'] = mockKv

    vi.stubEnv('POSTHOG_PROJECT_KEY', 'test-key')
    const { flag } = await import('./feature-flags')
    const result = await flag('my-experiment', 'user-xyz')

    expect(result).toBe('control')
    expect(fetchMock).toHaveBeenCalledOnce()
    expect(putMock).toHaveBeenCalledWith(
      'flag:my-experiment:user-xyz',
      '"control"',
      { expirationTtl: 60 },
    )

    delete (globalThis as Record<string, unknown>)['EXPERIMENT_KV']
    vi.unstubAllGlobals()
  })
})

// ---- (f) NOWPayments webhook emits tier_upgraded ----
describe('NOWPayments webhook: tier_upgraded emission', () => {
  it('(f) captureTierUpgraded is called when finished IPN succeeds', async () => {
    // Import the actual modules so we can spy on them
    const captureModule = await import('@/tree/signals/posthog-capture')
    const captureSpy = vi.spyOn(captureModule, 'captureTierUpgraded').mockResolvedValue(undefined)

    const nowpaymentsClient = await import('@/tree/clients/nowpayments-client')
    vi.spyOn(nowpaymentsClient, 'parseIpnWebhook').mockReturnValue({
      payment_id: 'pay-123',
      payment_status: 'finished',
      order_id: 'sophia_user-456_1234567890',
      price_amount: 99,
      price_currency: 'USD',
      invoice_id: '4559269964',
    })

    const ipnHandlers = await import('@/land/billing/nowpayments-ipn-handlers')
    const processSpy = vi.spyOn(ipnHandlers, 'processNowPaymentsIpn').mockResolvedValue({ success: true, message: 'ok' })

    vi.stubEnv('NOWPAYMENTS_IPN_SECRET', 'test-secret')

    const { POST } = await import('@/app/api/webhooks/nowpayments/route')

    const body = JSON.stringify({
      payment_id: 'pay-123',
      payment_status: 'finished',
      order_id: 'sophia_user-456_1234567890',
      price_amount: 99,
      price_currency: 'USD',
      invoice_id: '4559269964',
    })

    const req = new Request('https://sophia.agencyos.network/api/webhooks/nowpayments', {
      method: 'POST',
      headers: { 'x-nowpayments-sig': 'valid-sig', 'content-type': 'application/json' },
      body,
    }) as unknown as import('next/server').NextRequest

    await POST(req)

    expect(captureSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        distinctId: 'user-456',
        tier: 'PREMIUM',
        amount: 99,
        currency: 'USD',
      }),
    )

    captureSpy.mockRestore()
    processSpy.mockRestore()
    processSpy.mockRestore()
    vi.useRealTimers()
  }, 20000)
})
