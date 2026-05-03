/**
 * PayOS client tests — HMAC-SHA256 verification + tier config + flag gating.
 */

import { describe, it, expect, vi, afterEach } from 'vitest'
import { getPayOsTierConfig, verifyPayOsSignature, parseUserIdFromPayOsDescription } from '../payos'

describe('getPayOsTierConfig', () => {
  it('returns correct VND amounts for each tier', () => {
    const tiers = ['BASIC', 'PREMIUM', 'ENTERPRISE', 'MASTER'] as const
    for (const tier of tiers) {
      const config = getPayOsTierConfig(tier)
      expect(config.tier).toBe(tier)
      expect(config.vndAmount).toBeGreaterThan(0)
      expect(config.vndAmount % 1000).toBe(0) // rounded to 1000 VND
      expect(config.usdAmount).toBeGreaterThan(0)
    }
  })

  it('BASIC vndAmount = 199 * 25000 rounded to 1000', () => {
    const config = getPayOsTierConfig('BASIC')
    // 199 * 25000 = 4,975,000 → round to 1000 → 4,975,000
    expect(config.vndAmount).toBe(4975000)
  })
})

describe('verifyPayOsSignature', () => {
  const CHECKSUM_KEY = 'test-checksum-key'

  async function computeExpectedSig(data: Record<string, unknown>, key: string): Promise<string> {
    const sorted = Object.keys(data)
      .sort()
      .map(k => `${k}=${data[k]}`)
      .join('&')
    const enc = new TextEncoder()
    const cryptoKey = await crypto.subtle.importKey(
      'raw', enc.encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    )
    const sig = await crypto.subtle.sign('HMAC', cryptoKey, enc.encode(sorted))
    return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('')
  }

  it('accepts valid signature', async () => {
    const data = {
      orderCode: 123456,
      amount: 4975000,
      description: 'sophia_user123_1700000000000',
      paymentLinkId: 'link_abc123',
      transactionDateTime: '2026-05-03T10:00:00Z',
      currency: 'VND',
    }
    const sig = await computeExpectedSig(data as Record<string, unknown>, CHECKSUM_KEY)
    const result = await verifyPayOsSignature(data as Record<string, unknown>, sig, CHECKSUM_KEY)
    expect(result).toBe(true)
  })

  it('rejects tampered data', async () => {
    const data = { orderCode: 123456, amount: 4975000, description: 'sophia_user_1700', paymentLinkId: 'link_abc' }
    const sig = await computeExpectedSig(data as Record<string, unknown>, CHECKSUM_KEY)
    const tampered = { ...data, amount: 1000 }
    const result = await verifyPayOsSignature(tampered as Record<string, unknown>, sig, CHECKSUM_KEY)
    expect(result).toBe(false)
  })

  it('rejects wrong checksum key', async () => {
    const data = { orderCode: 999, amount: 100, paymentLinkId: 'link_x', description: 'test' }
    const sig = await computeExpectedSig(data as Record<string, unknown>, 'real-key')
    const result = await verifyPayOsSignature(data as Record<string, unknown>, sig, 'wrong-key')
    expect(result).toBe(false)
  })
})

describe('parseUserIdFromPayOsDescription', () => {
  it('extracts userId from sophia_ pattern', () => {
    expect(parseUserIdFromPayOsDescription('sophia_user123_1700000000000')).toBe('user123')
    expect(parseUserIdFromPayOsDescription('Sophia PREMIUM - sophia_abc456_1700000000001')).toBe('abc456')
  })

  it('returns null if pattern not found', () => {
    expect(parseUserIdFromPayOsDescription('random description')).toBeNull()
    expect(parseUserIdFromPayOsDescription('')).toBeNull()
  })
})

describe('createPayOsInvoice (flag gating)', () => {
  afterEach(() => {
    delete process.env.FEATURE_PAYOS
    vi.resetModules()
  })

  it('throws when FEATURE_PAYOS is not set', async () => {
    delete process.env.FEATURE_PAYOS
    const { createPayOsInvoice } = await import('../payos')
    await expect(createPayOsInvoice({
      tier: 'BASIC',
      period: 'monthly',
      userId: 'user123',
      orderId: 'sophia_user123_1700',
    })).rejects.toThrow('PayOS feature flag disabled')
  })
})
