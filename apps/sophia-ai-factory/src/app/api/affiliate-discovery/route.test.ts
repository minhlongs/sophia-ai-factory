/**
 * Tests for GET /api/affiliate-discovery (public catalog)
 *
 * Coverage:
 *   200 + empty offers when catalog is empty
 *   200 + data when rows exist
 *   Pagination: page=2 returns next set (offset applied)
 *   400 when query params are invalid
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/middleware/rate-limit-wrapper', () => ({
  withRateLimit: (handler: (req: NextRequest) => Promise<Response>) => handler,
}))

function makeChain(overrides: {
  data?: Record<string, unknown>[]
  count?: number
} = {}) {
  const result = { data: overrides.data ?? [], count: overrides.count ?? 0, error: null }
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    range: vi.fn().mockResolvedValue(result),
    then: undefined as unknown,
  }
  chain.then = (resolve: (v: typeof result) => unknown) => Promise.resolve(result).then(resolve)
  return chain
}

let mockRowChain: ReturnType<typeof makeChain>
let mockCountChain: ReturnType<typeof makeChain>

vi.mock('@/lib/db/client', () => ({
  createServerClient: vi.fn(() => ({
    from: vi.fn((table: string) => {
      if (table === 'affiliate_offers_catalog') {
        const callCount = (createServerClientFromMock.callCount ?? 0)
        createServerClientFromMock.callCount = callCount + 1
        return callCount % 2 === 0 ? mockRowChain : mockCountChain
      }
      return mockRowChain
    }),
  })),
}))

const createServerClientFromMock = { callCount: 0 }

import { GET } from './route'

const SAMPLE_OFFERS = [
  {
    id: 'aaa',
    offer_name: 'Bluehost Web Hosting',
    network: 'shareasale',
    url: 'https://www.bluehost.com/track/affiliateprogram/',
    commission_rate: 65.0,
    category: 'hosting',
    description: 'Earn $65+ per qualified sign-up.',
    created_at: '2026-04-29T00:00:00',
  },
  {
    id: 'bbb',
    offer_name: 'SEMrush SEO Toolkit',
    network: 'impact',
    url: 'https://www.semrush.com/lp/affiliate-program/',
    commission_rate: 40.0,
    category: 'seo',
    description: 'Recurring 40% commission.',
    created_at: '2026-04-29T00:00:00',
  },
]

function makeRequest(params: Record<string, string> = {}): NextRequest {
  const url = new URL('http://localhost/api/affiliate-discovery')
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  return new NextRequest(url)
}

describe('GET /api/affiliate-discovery (catalog)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    createServerClientFromMock.callCount = 0
    mockRowChain = makeChain({ data: [], count: 0 })
    mockCountChain = makeChain({ data: [], count: 0 })
  })

  it('200 + empty offers when catalog has no active rows', async () => {
    const res = await GET(makeRequest())
    expect(res.status).toBe(200)

    const json = (await res.json()) as { offers: unknown[]; total: number; page: number }
    expect(json.offers).toEqual([])
    expect(json.total).toBe(0)
    expect(json.page).toBe(1)
  })

  it('200 + offers array when active rows exist', async () => {
    mockRowChain = makeChain({ data: SAMPLE_OFFERS, count: 2 })
    mockCountChain = makeChain({ data: [], count: 2 })

    const res = await GET(makeRequest())
    expect(res.status).toBe(200)

    const json = (await res.json()) as { offers: typeof SAMPLE_OFFERS; total: number; page: number }
    expect(json.offers).toHaveLength(2)
    expect(json.offers[0].offer_name).toBe('Bluehost Web Hosting')
    expect(json.offers[0].url).toBe('https://www.bluehost.com/track/affiliateprogram/')
    expect(json.offers[0].category).toBe('hosting')
    expect(json.total).toBe(2)
  })

  it('filters by is_active=1', async () => {
    mockRowChain = makeChain({ data: SAMPLE_OFFERS, count: 2 })
    mockCountChain = makeChain({ data: [], count: 2 })

    await GET(makeRequest())
    expect(mockRowChain.eq).toHaveBeenCalledWith('is_active', 1)
    expect(mockCountChain.eq).toHaveBeenCalledWith('is_active', 1)
  })

  it('pagination — page=2 applies correct offset', async () => {
    mockRowChain = makeChain({ data: [], count: 60 })
    mockCountChain = makeChain({ data: [], count: 60 })

    const res = await GET(makeRequest({ page: '2', limit: '50' }))
    expect(res.status).toBe(200)

    const json = (await res.json()) as { page: number; total: number }
    expect(json.page).toBe(2)
    expect(json.total).toBe(60)
    expect(mockRowChain.range).toHaveBeenCalledWith(50, 99)
  })

  it('400 when limit exceeds 100', async () => {
    const res = await GET(makeRequest({ limit: '200' }))
    expect(res.status).toBe(400)
  })

  it('400 when page is 0', async () => {
    const res = await GET(makeRequest({ page: '0' }))
    expect(res.status).toBe(400)
  })
})
