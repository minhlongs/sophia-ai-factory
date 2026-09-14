/**
 * Tests for discoverAffiliateOffersAction Server Action
 *
 * Coverage:
 *  - UNAUTHORIZED when no authenticated session
 *  - INVALID_INPUT when schema validation fails
 *  - Success case when wave runs and returns ranked offers
 *  - Failure propagation when wave fails
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { discoverAffiliateOffersAction } from '../actions/discover-offers-action'
import { success, failure } from '@/seed/types/result'

const mockGetCurrentUser = vi.fn()
vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUser: () => mockGetCurrentUser(),
}))

const mockResolveOrgId = vi.fn()
vi.mock('@/seed/auth/resolve-org-id', () => ({
  resolveOrgId: (...args: unknown[]) => mockResolveOrgId(...args),
}))

vi.mock('@/seed/db/client', () => ({
  createServerClient: vi.fn(() => ({})),
}))

const mockRunAgenticDiscoveryWave = vi.fn()
vi.mock('../discovery-wave', () => ({
  runAgenticDiscoveryWave: (...args: unknown[]) => mockRunAgenticDiscoveryWave(...args),
}))

describe('discoverAffiliateOffersAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns UNAUTHORIZED when user is not logged in', async () => {
    mockGetCurrentUser.mockResolvedValue(null)

    const result = await discoverAffiliateOffersAction()
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('UNAUTHORIZED')
    }
  })

  it('returns INVALID_INPUT when minScore is out of bounds', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 'usr_123', email: 'test@example.com' })

    const result = await discoverAffiliateOffersAction({ minScore: 1.5 })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('INVALID_INPUT')
    }
  })

  it('resolves org_id and runs agentic discovery wave successfully', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 'usr_123', email: 'test@example.com' })
    mockResolveOrgId.mockResolvedValue('org_456')
    mockRunAgenticDiscoveryWave.mockResolvedValue(
      success({
        scannedCount: 15,
        qualifiedCount: 12,
        networkBreakdown: { clickbank: 5, awin: 5, shareasale: 5 },
        topOffers: [
          {
            externalId: 'cb-1',
            network: 'clickbank',
            title: 'Top SaaS Tool',
            description: 'High converting offer',
            productUrl: 'https://vendor.clickbank.net',
            imageUrl: '',
            commissionPct: 50,
            commissionFixedUsd: null,
            niche: 'saas',
            language: 'en',
            region: 'US',
            isTrending: true,
            qualityScore: 0.88,
            passesScamGate: true,
            scoreBreakdown: {},
          },
        ],
        completedAt: new Date().toISOString(),
      }),
    )

    const result = await discoverAffiliateOffersAction({ niche: 'ai', minScore: 0.6 })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.qualifiedCount).toBe(12)
      expect(result.value.topOffers[0].title).toBe('Top SaaS Tool')
    }
    expect(mockRunAgenticDiscoveryWave).toHaveBeenCalledWith(
      expect.objectContaining({
        niche: 'ai',
        minScore: 0.6,
        tenantId: 'org_456',
      }),
    )
  })

  it('propagates failure when wave returns error', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 'usr_123' })
    mockResolveOrgId.mockResolvedValue(null)
    mockRunAgenticDiscoveryWave.mockResolvedValue(failure(new Error('Network timeout')))

    const result = await discoverAffiliateOffersAction()
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('EXECUTION_FAILED')
      expect(result.error.message).toBe('Network timeout')
    }
  })
})
