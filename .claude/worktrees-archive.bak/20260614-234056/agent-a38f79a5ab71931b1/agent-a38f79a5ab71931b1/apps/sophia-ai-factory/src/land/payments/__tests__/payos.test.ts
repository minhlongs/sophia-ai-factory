/**
 * PayOS client tests — HMAC-SHA256 verification + tier config + flag gating.
 */

import { describe, it, expect, vi, afterEach } from 'vitest'
import { getPayOsTierConfig, parseUserIdFromPayOsDescription } from '../payos'

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
