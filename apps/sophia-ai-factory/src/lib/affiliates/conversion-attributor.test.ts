/**
 * Tests for conversion-attributor
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock logger before imports
vi.mock('@/lib/utils/logger-utility', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}))

import { attributeClick } from './conversion-attributor'

const mockFirst = vi.fn()
const mockBind = vi.fn(() => ({ first: mockFirst }))
const mockPrepare = vi.fn(() => ({ bind: mockBind }))
const mockDb = { prepare: mockPrepare }

beforeEach(() => {
  vi.clearAllMocks()
  // Inject mock D1 binding via globalThis.__env
  ;(globalThis as unknown as { __env: Record<string, unknown> }).__env = { DB: mockDb }
})

const validTid = 'a1b2c3d4e5f6a7b8c9d0e1f2'  // 24 hex chars

describe('attributeClick', () => {
  it('returns attribution when click found', async () => {
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

  it('returns null when no click found', async () => {
    mockFirst.mockResolvedValue(null)

    const result = await attributeClick(validTid)
    expect(result).toBeNull()
  })

  it('returns null for invalid tid (wrong length)', async () => {
    const result = await attributeClick('tooshort')
    expect(result).toBeNull()
    expect(mockPrepare).not.toHaveBeenCalled()
  })

  it('returns null for tid with non-hex chars', async () => {
    const result = await attributeClick('z1b2c3d4e5f6a7b8c9d0e1f2')
    expect(result).toBeNull()
    expect(mockPrepare).not.toHaveBeenCalled()
  })

  it('returns null for empty tid', async () => {
    const result = await attributeClick('')
    expect(result).toBeNull()
  })

  it('returns null when D1 throws', async () => {
    mockFirst.mockRejectedValue(new Error('D1 error'))

    const result = await attributeClick(validTid)
    expect(result).toBeNull()
  })
})
