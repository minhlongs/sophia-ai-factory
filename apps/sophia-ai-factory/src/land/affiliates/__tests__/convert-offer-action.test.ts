/**
 * Tests for convertOfferToCampaignAction Server Action
 *
 * Covers:
 * - UNAUTHORIZED when no authenticated session
 * - INVALID_INPUT when schema validation fails
 * - Successful campaign creation delegation to convertOfferToCampaign
 * - Failure code propagation from bridge failure
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { convertOfferToCampaignAction } from '../actions/convert-offer-action'
import {
  rankedDiscoveredOfferSchema,
  convertOfferInputSchema,
} from '../campaign-bridge'
import { success, failure } from '@/seed/types/result'
import type { AutoVideoMissionResult } from '@/land/missions/auto-video-mission'

const mockGetCurrentUser = vi.fn()
vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUser: () => mockGetCurrentUser(),
}))

vi.mock('@/seed/auth/resolve-org-id', () => ({
  resolveOrgId: vi.fn().mockResolvedValue('org_test_123'),
}))

vi.mock('@/seed/db/client', () => ({
  createServerClient: vi.fn(() => ({})),
}))

const mockConvertOfferToCampaign = vi.fn()
vi.mock('../campaign-bridge', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../campaign-bridge')>()
  return {
    ...actual,
    convertOfferToCampaign: (...args: unknown[]) => mockConvertOfferToCampaign(...args),
  }
})

describe('convertOfferToCampaignAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const validOffer = {
    externalId: 'cb-offer-1',
    network: 'clickbank',
    title: 'Top AI Tool',
    description: 'High converting SaaS',
    productUrl: 'https://hop.clickbank.net',
    imageUrl: '',
    commissionPct: 40,
    commissionFixedUsd: null,
    niche: 'saas',
    language: 'en',
    region: 'US',
    isTrending: true,
    qualityScore: 0.9,
    passesScamGate: true,
    scoreBreakdown: {},
  }

  it('returns UNAUTHORIZED when user is not logged in', async () => {
    mockGetCurrentUser.mockResolvedValue(null)

    const result = await convertOfferToCampaignAction({ offer: validOffer })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('UNAUTHORIZED')
    }
  })

  it('returns INVALID_INPUT when offer is missing externalId', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 'usr_1', email: 'test@example.com' })

    const invalidOffer = { ...validOffer, externalId: '' }
    const result = await convertOfferToCampaignAction({ offer: invalidOffer })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('INVALID_INPUT')
    }
  })

  it('delegates to convertOfferToCampaign on valid input', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 'usr_1', email: 'test@example.com' })
    const mockResult: AutoVideoMissionResult = {
      missionId: 'msn_1',
      script: {
        primary: { language: 'en', body: 'Script body', seoScore: 90, suggestedTitles: ['Title'], wordCount: 100 },
      },
      description: { body: 'Desc', affiliateCount: 1 },
      status: 'succeeded',
    }
    mockConvertOfferToCampaign.mockResolvedValue(success(mockResult))

    const result = await convertOfferToCampaignAction({ offer: validOffer, maxAffiliateLinks: 2 })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.missionId).toBe('msn_1')
    }
    expect(mockConvertOfferToCampaign).toHaveBeenCalledWith(
      validOffer,
      expect.objectContaining({ userId: 'usr_1', maxAffiliateLinks: 2 }),
    )
  })

  it('propagates failure from convertOfferToCampaign', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 'usr_1' })
    mockConvertOfferToCampaign.mockResolvedValue(
      failure({ code: 'BYOK_REQUIRED', message: 'API key needed', missionId: 'msn_2' }),
    )

    const result = await convertOfferToCampaignAction({ offer: validOffer })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('BYOK_REQUIRED')
      expect(result.error.message).toBe('API key needed')
    }
  })

  describe('schemas from campaign-bridge', () => {
    it('rankedDiscoveredOfferSchema validates a valid offer and applies defaults', () => {
      const parsed = rankedDiscoveredOfferSchema.safeParse({
        externalId: 'cb-test',
        network: 'clickbank',
        title: 'Title',
      })
      expect(parsed.success).toBe(true)
      if (parsed.success) {
        expect(parsed.data.niche).toBe('saas')
        expect(parsed.data.language).toBe('en')
        expect(parsed.data.region).toBe('US')
        expect(parsed.data.isTrending).toBe(false)
        expect(parsed.data.qualityScore).toBe(0)
        expect(parsed.data.passesScamGate).toBe(true)
      }
    })

    it('convertOfferInputSchema rejects missing offer or invalid languages', () => {
      const empty = convertOfferInputSchema.safeParse({})
      expect(empty.success).toBe(false)

      const invalidLang = convertOfferInputSchema.safeParse({
        offer: { externalId: 'cb-1', network: 'awin', title: 'Test' },
        primaryLanguage: 'fr',
      })
      expect(invalidLang.success).toBe(false)
    })
  })
})
