/**
 * Tests for enforce-tier-quota.ts (P0.2)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/seed/db/resolve-user-tier', () => ({
  resolveUserTier: vi.fn(),
}))

vi.mock('@/forest/quota/video-quota', () => ({
  checkVideoQuota: vi.fn(),
  VIDEO_QUOTA_BY_TIER: {
    BASIC: 0,
    PREMIUM: 30,
    ENTERPRISE: 200,
    MASTER: 1000,
  },
}))

import { resolveUserTier } from '@/seed/db/resolve-user-tier'
import { checkVideoQuota } from '@/forest/quota/video-quota'
import { checkTierQuota } from '@/forest/auth/enforce-tier-quota'

const mockResolveUserTier = resolveUserTier as ReturnType<typeof vi.fn>
const mockCheckVideoQuota = checkVideoQuota as ReturnType<typeof vi.fn>

describe('checkTierQuota', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns allowed=false for BASIC tier (limit=0)', async () => {
    mockResolveUserTier.mockResolvedValue('BASIC')
    const result = await checkTierQuota('user-basic')
    expect(result.allowed).toBe(false)
    expect(result.limit).toBe(0)
    expect(result.reason).toContain('BASIC')
    expect(mockCheckVideoQuota).not.toHaveBeenCalled()
  })

  it('returns allowed=true when under quota', async () => {
    mockResolveUserTier.mockResolvedValue('PREMIUM')
    mockCheckVideoQuota.mockResolvedValue({
      allowed: true,
      used: 5,
      limit: 30,
      resetAt: '2026-06-01T00:00:00.000Z',
    })
    const result = await checkTierQuota('user-premium')
    expect(result.allowed).toBe(true)
    expect(result.used).toBe(5)
    expect(result.limit).toBe(30)
    expect(result.reason).toBeUndefined()
  })

  it('returns allowed=false with reason when quota exceeded', async () => {
    mockResolveUserTier.mockResolvedValue('PREMIUM')
    mockCheckVideoQuota.mockResolvedValue({
      allowed: false,
      used: 30,
      limit: 30,
      resetAt: '2026-06-01T00:00:00.000Z',
    })
    const result = await checkTierQuota('user-over')
    expect(result.allowed).toBe(false)
    expect(result.reason).toContain('30')
    expect(result.reason).toContain('PREMIUM')
  })

  it('returns correct limit for ENTERPRISE tier', async () => {
    mockResolveUserTier.mockResolvedValue('ENTERPRISE')
    mockCheckVideoQuota.mockResolvedValue({
      allowed: true,
      used: 10,
      limit: 200,
      resetAt: '2026-06-01T00:00:00.000Z',
    })
    const result = await checkTierQuota('user-enterprise')
    expect(result.allowed).toBe(true)
    expect(result.limit).toBe(200)
  })
})
