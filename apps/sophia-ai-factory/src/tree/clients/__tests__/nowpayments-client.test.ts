/**
 * Tests for NOWPayments client.
 *
 * NOWPayments IPN webhook → tier activation is a PROTECTED FLOW per CLAUDE.md
 * (Polar.sh REJECTED — NOWPayments is the sole crypto payment provider).
 * These tests pin checkout URL building, IPN signature verification wiring,
 * and the discriminated invoice lookup (one-time vs subscription).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@/seed/security/signature', () => ({
  verifyInboundWebhook: vi.fn(),
}))

import {
  NOWPAYMENTS_TIERS,
  createInvoiceUrl,
  createOneTimeInvoiceUrl,
  getTierByInvoiceId,
  lookupInvoice,
  verifyIpnSignature,
} from '../nowpayments-client'
import { verifyInboundWebhook } from '@/seed/security/signature'
import { ONE_TIME_SKUS } from '@/seed/config/one-time-skus'

const mockVerify = vi.mocked(verifyInboundWebhook)

const FIXED_NOW = 1735689600000 // 2025-01-01T00:00:00Z — deterministic order_id timestamp

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers()
  vi.setSystemTime(new Date(FIXED_NOW))
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
})

describe('NOWPAYMENTS_TIERS catalog', () => {
  it('has all 4 subscription tiers with non-empty invoice IDs', () => {
    for (const key of ['BASIC', 'PREMIUM', 'ENTERPRISE', 'MASTER'] as const) {
      expect(NOWPAYMENTS_TIERS[key]).toBeDefined()
      expect(NOWPAYMENTS_TIERS[key].tier).toBe(key)
      expect(NOWPAYMENTS_TIERS[key].invoiceId).toMatch(/^\d+$/)
      expect(NOWPAYMENTS_TIERS[key].price).toBeGreaterThan(0)
      expect(NOWPAYMENTS_TIERS[key].currency).toBe('USD')
    }
  })

  it('tier invoice IDs are all distinct', () => {
    const ids = Object.values(NOWPAYMENTS_TIERS).map((t) => t.invoiceId)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('does not collide with one-time SKU invoice IDs (CEO invariant)', () => {
    const tierIds = new Set(Object.values(NOWPAYMENTS_TIERS).map((t) => t.invoiceId))
    for (const sku of Object.values(ONE_TIME_SKUS)) {
      expect(tierIds.has(sku.invoiceId)).toBe(false)
    }
  })
})

describe('createInvoiceUrl', () => {
  it('throws for unknown tier', () => {
    expect(() => createInvoiceUrl('GHOST_TIER', 'user-1')).toThrow(/Unknown tier: GHOST_TIER/)
  })

  it('builds URL with iid + order_id', () => {
    const url = createInvoiceUrl('BASIC', 'user-abc')
    const u = new URL(url)
    expect(u.origin + u.pathname).toBe('https://nowpayments.io/payment')
    expect(u.searchParams.get('iid')).toBe(NOWPAYMENTS_TIERS.BASIC.invoiceId)
    expect(u.searchParams.get('order_id')).toBe(`sophia_user-abc_${FIXED_NOW}`)
  })

  it('success_url includes tier + order_id', () => {
    const url = createInvoiceUrl('PREMIUM', 'user-x')
    const success = new URL(decodeURIComponent(new URL(url).searchParams.get('success_url')!))
    expect(success.searchParams.get('tier')).toBe('PREMIUM')
    expect(success.searchParams.get('order_id')).toBe(`sophia_user-x_${FIXED_NOW}`)
  })

  it('uses NEXT_PUBLIC_APP_URL when set', () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://staging.example.com')
    const url = createInvoiceUrl('BASIC', 'user-1')
    const successRaw = new URL(url).searchParams.get('success_url')!
    expect(successRaw).toContain('https://staging.example.com/payment-success')
  })

  it('falls back to sophia.agencyos.network when env missing', () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', '')
    const url = createInvoiceUrl('BASIC', 'user-1')
    const successRaw = new URL(url).searchParams.get('success_url')!
    expect(successRaw).toContain('https://sophia.agencyos.network/payment-success')
  })

  it('embeds customerEmail in success_url when provided', () => {
    const url = createInvoiceUrl('ENTERPRISE', 'user-2', 'ceo@example.com')
    const successRaw = new URL(url).searchParams.get('success_url')!
    // success_url is URL-encoded once for outer params; inner email is encodeURIComponent'd by code
    expect(successRaw).toContain('email=')
    expect(successRaw).toContain('ceo')
  })

  it('omits email when customerEmail not provided', () => {
    const url = createInvoiceUrl('BASIC', 'user-3')
    const successRaw = new URL(url).searchParams.get('success_url')!
    expect(successRaw).not.toContain('email=')
  })

  it('cancel_url points to /pricing', () => {
    const url = createInvoiceUrl('BASIC', 'user-1')
    expect(new URL(url).searchParams.get('cancel_url')).toContain('/pricing')
  })
})

describe('verifyIpnSignature', () => {
  it('delegates to verifyInboundWebhook with SHA-512 + nowpayments canonicalization', async () => {
    mockVerify.mockResolvedValue(true)
    const result = await verifyIpnSignature('{"a":1,"b":2}', 'sig123', 'secret')

    expect(result).toBe(true)
    expect(mockVerify).toHaveBeenCalledTimes(1)
    const [body, sig, secret, opts] = mockVerify.mock.calls[0]
    expect(body).toBe('{"a":1,"b":2}')
    expect(sig).toBe('sig123')
    expect(secret).toBe('secret')
    expect(opts.algo).toBe('SHA-512')
    expect(typeof opts.canonicalize).toBe('function')
  })

  it('canonicalize sorts keys before stringifying', async () => {
    mockVerify.mockImplementation(async (_body, _sig, _secret, opts) => {
      // Invoke the canonicalize closure to verify sort behavior
      const out = opts.canonicalize!('{"z":1,"a":2,"m":3}')
      expect(out).toBe('{"a":2,"m":3,"z":1}')
      return true
    })

    await verifyIpnSignature('{"z":1,"a":2,"m":3}', 'sig', 'secret')
  })

  it('returns false when verifyInboundWebhook returns false', async () => {
    mockVerify.mockResolvedValue(false)
    expect(await verifyIpnSignature('{}', 'bad-sig', 'secret')).toBe(false)
  })
})

describe('getTierByInvoiceId', () => {
  it('returns config for each known tier invoiceId', () => {
    for (const tier of Object.values(NOWPAYMENTS_TIERS)) {
      const found = getTierByInvoiceId(tier.invoiceId)
      expect(found).toEqual(tier)
    }
  })

  it('returns null for unknown invoiceId', () => {
    expect(getTierByInvoiceId('9999999999')).toBeNull()
  })
})

describe('lookupInvoice', () => {
  it('returns one_time discriminant for one-time SKU invoiceId', () => {
    const skus = Object.values(ONE_TIME_SKUS)
    expect(skus.length).toBeGreaterThan(0)
    const sku = skus[0]
    const result = lookupInvoice(sku.invoiceId)
    expect(result).toEqual({ kind: 'one_time', sku })
  })

  it('returns subscription discriminant for tier invoiceId', () => {
    const tier = NOWPAYMENTS_TIERS.PREMIUM
    const result = lookupInvoice(tier.invoiceId)
    expect(result).toEqual({ kind: 'subscription', tier: 'PREMIUM', config: tier })
  })

  it('returns null for unknown invoiceId', () => {
    expect(lookupInvoice('0000000000')).toBeNull()
  })
})

describe('createOneTimeInvoiceUrl', () => {
  const sku = Object.values(ONE_TIME_SKUS)[0]

  it('builds URL with sku.invoiceId as iid', () => {
    const url = createOneTimeInvoiceUrl(sku, 'user-1')
    expect(new URL(url).searchParams.get('iid')).toBe(sku.invoiceId)
  })

  it('success_url includes sku.id + order_id', () => {
    const url = createOneTimeInvoiceUrl(sku, 'user-x')
    const successRaw = new URL(url).searchParams.get('success_url')!
    expect(successRaw).toContain(`sku=${sku.id}`)
    expect(successRaw).toContain(`order_id=sophia_user-x_${FIXED_NOW}`)
  })

  it('embeds customerEmail when provided', () => {
    const url = createOneTimeInvoiceUrl(sku, 'user-2', 'buyer@example.com')
    const successRaw = new URL(url).searchParams.get('success_url')!
    expect(successRaw).toContain('email=')
  })

  it('omits email when not provided', () => {
    const url = createOneTimeInvoiceUrl(sku, 'user-3')
    const successRaw = new URL(url).searchParams.get('success_url')!
    expect(successRaw).not.toContain('email=')
  })

  it('falls back to sophia.agencyos.network when env missing', () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', '')
    const url = createOneTimeInvoiceUrl(sku, 'user-1')
    const successRaw = new URL(url).searchParams.get('success_url')!
    expect(successRaw).toContain('https://sophia.agencyos.network/payment-success')
  })
})
