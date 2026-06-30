/**
 * Contract tests for conversion-attributor
 *
 * Tests public API behavior of attributeClick and attributeByNetwork
 * including input validation, DB error handling, and result shapes.
 *
 * @module affiliates/__tests__/conversion-attributor-contract
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock logger before imports
vi.mock('@/seed/utils/logger-utility', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}))

import { attributeClick, attributeByNetwork } from '../conversion-attributor'

const mockFirst = vi.fn()
const mockBind = vi.fn(() => ({ first: mockFirst }))
const mockPrepare = vi.fn(() => ({ bind: mockBind }))
const mockDb = { prepare: mockPrepare }

beforeEach(() => {
  vi.clearAllMocks()
  ;(globalThis as unknown as { __env: Record<string, unknown> }).__env = { DB: mockDb }
})

describe('attributeClick', () => {
  const validTid = 'a1b2c3d4e5f6a7b8c9d0e1f2' // 24 hex chars

  it('returns attribution for valid 24-char hex tid', async () => {
    mockFirst.mockResolvedValue({
      click_id: 'a1b2c3d4-e5f6-a7b8-c9d0-e1f2abcd1234',
      campaign_id: 'camp-1',
      user_id: 'user-1',
      offer_id: 'phenq',
    })

    const result = await attributeClick(validTid)

    expect(result).toEqual({
      clickId: 'a1b2c3d4-e5f6-a7b8-c9d0-e1f2abcd1234',
      campaignId: 'camp-1',
      userId: 'user-1',
      offerId: 'phenq',
    })
    expect(mockBind).toHaveBeenCalledWith(validTid)
  })

  it('returns null for invalid tid format (non-hex characters)', async () => {
    const result = await attributeClick('z1b2c3d4e5f6a7b8c9d0e1f2')
    expect(result).toBeNull()
    expect(mockPrepare).not.toHaveBeenCalled()
  })

  it('returns null for invalid tid format (wrong length)', async () => {
    const result = await attributeClick('tooshort')
    expect(result).toBeNull()
    expect(mockPrepare).not.toHaveBeenCalled()
  })

  it('returns null for SQL injection attempt in tid (regex rejects non-hex)', async () => {
    const result = await attributeClick("' OR '1'='1")
    expect(result).toBeNull()
    expect(mockPrepare).not.toHaveBeenCalled()
  })

  it('returns null for empty tid', async () => {
    const result = await attributeClick('')
    expect(result).toBeNull()
    expect(mockPrepare).not.toHaveBeenCalled()
  })

  it('returns null when D1 binding is unavailable', async () => {
    // Remove the mock DB binding
    delete (globalThis as unknown as Record<string, unknown>).__env

    const result = await attributeClick(validTid)
    expect(result).toBeNull()
  })
})

describe('attributeByNetwork', () => {
  it('returns attribution for valid subId', async () => {
    mockFirst.mockResolvedValue({
      id: 'link-1',
      tenant_id: 'tenant-1',
      offer_id: 'offer-1',
      user_id: 'user-1',
    })

    const result = await attributeByNetwork('tiktok-shop', 'tenantSlug-a1b2c3d4')

    expect(result).toEqual({
      linkId: 'link-1',
      tenantId: 'tenant-1',
      offerId: 'offer-1',
      userId: 'user-1',
    })
    expect(mockBind).toHaveBeenCalledWith('tenantSlug-a1b2c3d4')
  })

  it('returns null for empty subId', async () => {
    const result = await attributeByNetwork('tiktok-shop', '')
    expect(result).toBeNull()
    expect(mockPrepare).not.toHaveBeenCalled()
  })

  it('returns null when D1 binding is unavailable', async () => {
    delete (globalThis as unknown as Record<string, unknown>).__env

    const result = await attributeByNetwork('tiktok-shop', 'tenantSlug-a1b2c3d4')
    expect(result).toBeNull()
  })

  it('returns null when no link found for subId', async () => {
    mockFirst.mockResolvedValue(null)

    const result = await attributeByNetwork('accesstrade', 'nonexistent-slug')
    expect(result).toBeNull()
  })
})
