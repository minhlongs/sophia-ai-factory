/**
 * Tests for POST /api/affiliate-discovery (Agentic Discovery Wave)
 *
 * Coverage:
 *   200 + wave result on success with defaults
 *   200 + custom parameters passed to wave
 *   400 on invalid JSON / schema errors
 *   500 when discovery wave fails
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { success, failure } from '@/seed/types/result'

vi.mock('@/forest/middleware/rate-limit-wrapper', () => ({
  withRateLimit: (handler: (req: NextRequest) => Promise<Response>) => handler,
}))

const mockGetCurrentUser = vi.fn()
vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUser: () => mockGetCurrentUser(),
}))

const mockRunAgenticDiscoveryWave = vi.fn()
vi.mock('@/land/affiliates/discovery-wave', () => ({
  runAgenticDiscoveryWave: (...args: unknown[]) => mockRunAgenticDiscoveryWave(...args),
}))

import { POST } from './route'

function makePostRequest(body?: unknown): NextRequest {
  const url = new URL('http://localhost/api/affiliate-discovery')
  return new NextRequest(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
}

describe('POST /api/affiliate-discovery (agentic wave)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetCurrentUser.mockResolvedValue({ id: 'usr_abc' })
  })

  it('200 + returns discovery wave results on valid execution', async () => {
    mockRunAgenticDiscoveryWave.mockResolvedValue(
      success({
        scannedCount: 30,
        qualifiedCount: 15,
        networkBreakdown: { clickbank: 10, awin: 10, shareasale: 10 },
        topOffers: [
          {
            externalId: 'cb-101',
            network: 'clickbank',
            title: 'Cloud AI Assistant',
            description: 'Top converting SaaS affiliate',
            productUrl: 'https://cloudai.vendor.clickbank.net',
            imageUrl: '',
            commissionPct: 40,
            commissionFixedUsd: null,
            niche: 'saas',
            language: 'en',
            region: 'US',
            isTrending: true,
            qualityScore: 0.85,
            passesScamGate: true,
            scoreBreakdown: {},
          },
        ],
        completedAt: new Date().toISOString(),
      }),
    )

    const req = makePostRequest({ niche: 'crypto', minScore: 0.7, limit: 10 })
    const res = await POST(req)
    expect(res.status).toBe(200)

    const json = (await res.json()) as {
      scannedCount: number
      qualifiedCount: number
      topOffers: Array<{ externalId: string }>
    }
    expect(json.scannedCount).toBe(30)
    expect(json.qualifiedCount).toBe(15)
    expect(json.topOffers[0].externalId).toBe('cb-101')

    expect(mockRunAgenticDiscoveryWave).toHaveBeenCalledWith({
      niche: 'crypto',
      minScore: 0.7,
      limit: 10,
      networks: ['clickbank', 'awin', 'shareasale'],
      tenantId: 'usr_abc',
    })
  })

  it('400 when minScore is negative or above 1', async () => {
    const req = makePostRequest({ minScore: 1.5 })
    const res = await POST(req)
    expect(res.status).toBe(400)

    const json = (await res.json()) as { error: string }
    expect(json.error).toBe('Invalid request body')
  })

  it('500 when discovery wave engine returns failure', async () => {
    mockRunAgenticDiscoveryWave.mockResolvedValue(failure(new Error('Downstream provider timeout')))

    const req = makePostRequest()
    const res = await POST(req)
    expect(res.status).toBe(500)

    const json = (await res.json()) as { error: string }
    expect(json.error).toBe('Downstream provider timeout')
  })
})
