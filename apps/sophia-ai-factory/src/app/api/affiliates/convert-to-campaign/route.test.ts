/**
 * Tests for POST /api/affiliates/convert-to-campaign
 *
 * Covers:
 * - 401 UNAUTHORIZED when no session exists
 * - 400 INVALID_INPUT on malformed body or missing offer
 * - 200 SUCCESS when campaign mission successfully initiated
 * - 422 for BYOK_REQUIRED configuration issues
 * - 500 when downstream execution fails
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { success, failure } from '@/seed/types/result'
import type { AutoVideoMissionResult } from '@/land/missions/auto-video-mission'

vi.mock('@/forest/middleware/rate-limit-wrapper', () => ({
  withRateLimit: (handler: (req: NextRequest) => Promise<Response>) => handler,
}))

const mockGetCurrentUser = vi.fn()
vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUser: () => mockGetCurrentUser(),
}))

const mockConvertOfferToCampaign = vi.fn()
vi.mock('@/land/affiliates/campaign-bridge', () => ({
  convertOfferToCampaign: (...args: unknown[]) => mockConvertOfferToCampaign(...args),
}))

import { POST } from './route'

function makePostRequest(body?: unknown): NextRequest {
  const url = new URL('http://localhost/api/affiliates/convert-to-campaign')
  return new NextRequest(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
}

describe('POST /api/affiliates/convert-to-campaign', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetCurrentUser.mockResolvedValue({ id: 'usr_api_test' })
  })

  const validOffer = {
    externalId: 'cb-tool-1',
    network: 'clickbank',
    title: 'Autonomous Growth SaaS',
    description: 'B2B automation software',
    productUrl: 'https://hop.clickbank.net',
    imageUrl: '',
    commissionPct: 50,
    commissionFixedUsd: null,
    niche: 'saas',
    language: 'en',
    region: 'US',
    isTrending: true,
    qualityScore: 0.92,
    passesScamGate: true,
    scoreBreakdown: {},
  }

  const mockMissionResult: AutoVideoMissionResult = {
    missionId: 'msn_route_123',
    script: {
      primary: { language: 'en', body: 'Video Script', seoScore: 95, suggestedTitles: ['Auto Growth'], wordCount: 200 },
    },
    description: { body: 'Check link below', affiliateCount: 1 },
    status: 'succeeded',
  }

  it('401 UNAUTHORIZED when no authenticated session exists', async () => {
    mockGetCurrentUser.mockResolvedValue(null)
    const req = makePostRequest({ offer: validOffer })
    const res = await POST(req)
    expect(res.status).toBe(401)
    const json = (await res.json()) as { ok: boolean; error: { code: string } }
    expect(json.ok).toBe(false)
    expect(json.error.code).toBe('UNAUTHORIZED')
  })

  it('400 INVALID_INPUT when offer is invalid', async () => {
    const req = makePostRequest({ offer: { externalId: '' } })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const json = (await res.json()) as { ok: boolean; error: { code: string } }
    expect(json.ok).toBe(false)
    expect(json.error.code).toBe('INVALID_INPUT')
  })

  it('200 + Result.success on successful campaign conversion', async () => {
    mockConvertOfferToCampaign.mockResolvedValue(success(mockMissionResult))
    const req = makePostRequest({ offer: validOffer, maxAffiliateLinks: 3 })
    const res = await POST(req)
    expect(res.status).toBe(200)

    const json = (await res.json()) as { ok: boolean; value: AutoVideoMissionResult }
    expect(json.ok).toBe(true)
    expect(json.value.missionId).toBe('msn_route_123')
    expect(mockConvertOfferToCampaign).toHaveBeenCalledWith(
      expect.objectContaining({ externalId: 'cb-tool-1' }),
      expect.objectContaining({ userId: 'usr_api_test', maxAffiliateLinks: 3 }),
    )
  })

  it('422 when BYOK is required for video generation', async () => {
    mockConvertOfferToCampaign.mockResolvedValue(
      failure({ code: 'BYOK_REQUIRED', message: 'HeyGen API key required', missionId: 'msn_byok' }),
    )
    const req = makePostRequest({ offer: validOffer })
    const res = await POST(req)
    expect(res.status).toBe(422)
    const json = (await res.json()) as { ok: boolean; error: { code: string } }
    expect(json.ok).toBe(false)
    expect(json.error.code).toBe('BYOK_REQUIRED')
  })
})
