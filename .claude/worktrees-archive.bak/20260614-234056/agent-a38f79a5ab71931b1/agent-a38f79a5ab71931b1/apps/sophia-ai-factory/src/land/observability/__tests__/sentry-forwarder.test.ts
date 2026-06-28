/**
 * Unit tests for sentry-forwarder utilities.
 * Verifies PII stripping, DSN parsing, and fire-and-forget behavior.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  stripPii,
  parseSentryProjectId,
  parseSentryEndpoint,
  buildSentryAuthHeader,
  forwardToSentry,
} from '../sentry-forwarder'

describe('stripPii', () => {
  it('removes email and payment_id fields', () => {
    const result = stripPii({
      email: 'user@example.com',
      payment_id: 'pay_abc123',
      userId: 'user-uuid',
      purchaseId: 'purch-uuid',
    })
    expect(result).toEqual({ userId: 'user-uuid', purchaseId: 'purch-uuid' })
  })

  it('keeps allowed keys: userId, purchaseId, videoId, sku, stage', () => {
    const result = stripPii({
      userId: 'u1',
      purchaseId: 'p1',
      videoId: 'v1',
      sku: 'STARTER_BUNDLE',
      stage: 'enqueue',
    })
    expect(result).toEqual({
      userId: 'u1',
      purchaseId: 'p1',
      videoId: 'v1',
      sku: 'STARTER_BUNDLE',
      stage: 'enqueue',
    })
  })

  it('returns undefined when no allowed keys remain', () => {
    const result = stripPii({ email: 'a@b.com', secret: 'x', token: 'y' })
    expect(result).toBeUndefined()
  })

  it('returns undefined when called with undefined', () => {
    expect(stripPii(undefined)).toBeUndefined()
  })
})

describe('parseSentryProjectId', () => {
  it('extracts project id from standard DSN', () => {
    expect(parseSentryProjectId('https://abc123@o456.ingest.sentry.io/789'))
      .toBe('789')
  })

  it('returns null for invalid DSN', () => {
    expect(parseSentryProjectId('not-a-url')).toBeNull()
  })
})

describe('parseSentryEndpoint', () => {
  it('returns protocol + host for valid DSN', () => {
    expect(parseSentryEndpoint('https://abc@o456.ingest.sentry.io/789'))
      .toBe('https://o456.ingest.sentry.io')
  })

  it('returns null for invalid DSN', () => {
    expect(parseSentryEndpoint('bad-dsn')).toBeNull()
  })
})

describe('buildSentryAuthHeader', () => {
  it('builds auth header with key from DSN', () => {
    const header = buildSentryAuthHeader('https://mykey@o123.ingest.sentry.io/456')
    expect(header).toContain('sentry_key=mykey')
    expect(header).toContain('sentry_version=7')
  })

  it('returns null for DSN without key', () => {
    expect(buildSentryAuthHeader('https://o123.ingest.sentry.io/456')).toBeNull()
  })
})

describe('forwardToSentry', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    delete process.env.NEXT_PUBLIC_SENTRY_DSN
    delete process.env.SENTRY_DSN
  })

  it('does nothing when no DSN env is set', async () => {
    await forwardToSentry({ level: 'error', message: 'test error' })
    expect(vi.mocked(fetch)).not.toHaveBeenCalled()
  })

  it('calls fetch when DSN is set', async () => {
    process.env.NEXT_PUBLIC_SENTRY_DSN = 'https://key123@o999.ingest.sentry.io/111'
    await forwardToSentry({ level: 'error', message: 'oops', extra: { userId: 'u1' } })
    expect(vi.mocked(fetch)).toHaveBeenCalledOnce()
    const callArgs = vi.mocked(fetch).mock.calls[0]
    expect(callArgs[0]).toContain('/api/111/envelope/')
    // Envelope format: 3 newline-delimited parts — header, item-header, event JSON
    const rawBody = callArgs[1]?.body as string
    const parts = rawBody.split('\n')
    expect(parts.length).toBeGreaterThanOrEqual(3)
    const eventBody = JSON.parse(parts[2])
    expect(eventBody.message).toBe('oops')
    expect(eventBody.extra).toEqual({ userId: 'u1' })
  })

  it('silently swallows fetch errors (fire-and-forget)', async () => {
    process.env.SENTRY_DSN = 'https://key@o1.ingest.sentry.io/1'
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')))
    // Must not throw
    await expect(forwardToSentry({ level: 'error', message: 'fail' })).resolves.toBeUndefined()
  })
})
