/**
 * Tests for GET /api/affiliate-discovery
 *
 * Coverage:
 *   200 + empty offers when table is empty
 *   200 + data when rows exist
 *   Pagination: page=2 returns next set (offset applied)
 *   400 when query params are invalid
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// --- Mocks ---

vi.mock('@/middleware/rate-limit-wrapper', () => ({
  withRateLimit: (handler: (req: NextRequest) => Promise<Response>) => handler,
}))

// Reusable mock chain builder
function makeChain(overrides: {
  data?: Record<string, unknown>[]
  count?: number
  error?: null
} = {}) {
  const result = { data: overrides.data ?? [], count: overrides.count ?? 0, error: null }
  const chain = {
    select: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    range: vi.fn().mockResolvedValue(result),
    then: undefined as unknown,
  }
  // Make `await chain` work by resolving to result
  chain.then = (resolve: (v: typeof result) => unknown) => Promise.resolve(result).then(resolve)
  return chain
}

let mockRowChain: ReturnType<typeof makeChain>
let mockCountChain: ReturnType<typeof makeChain>

vi.mock('@/lib/db/client', () => ({
  createServerClient: vi.fn(() => ({
    from: vi.fn((table: string) => {
      if (table === 'affiliate_offers_selected') {
        // First call → rows, second call → count
        const callCount = (createServerClientFromMock.callCount ?? 0)
        if (callCount % 2 === 0) {
          createServerClientFromMock.callCount = (callCount) + 1
          return mockRowChain
        }
        createServerClientFromMock.callCount = (callCount) + 1
        return mockCountChain
      }
      return mockRowChain
    }),
  })),
}))

// Track from() call order via a counter on the mock instance
const createServerClientFromMock = { callCount: 0 }

import { GET } from './route'

const SAMPLE_OFFERS = [
  { id: 'aaa', offer_name: 'AI Video Editor', network: 'clickbank', commission_rate: 0.3, created_at: '2026-04-01T00:00:00' },
  { id: 'bbb', offer_name: 'SEO Pro Tool', network: 'shareasale', commission_rate: 0.25, created_at: '2026-04-02T00:00:00' },
]

function makeRequest(params: Record<string, string> = {}): NextRequest {
  const url = new URL('http://localhost/api/affiliate-discovery')
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  return new NextRequest(url)
}

describe('GET /api/affiliate-discovery', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    createServerClientFromMock.callCount = 0
    mockRowChain = makeChain({ data: [], count: 0 })
    mockCountChain = makeChain({ data: [], count: 0 })
  })

  it('200 + empty offers when table has no rows', async () => {
    mockRowChain = makeChain({ data: [], count: 0 })
    mockCountChain = makeChain({ data: [], count: 0 })

    const res = await GET(makeRequest())
    expect(res.status).toBe(200)

    const json = (await res.json()) as { offers: unknown[]; total: number; page: number }
    expect(json.offers).toEqual([])
    expect(json.total).toBe(0)
    expect(json.page).toBe(1)
  })

  it('200 + offers array when rows exist', async () => {
    mockRowChain = makeChain({ data: SAMPLE_OFFERS, count: 2 })
    mockCountChain = makeChain({ data: [], count: 2 })

    const res = await GET(makeRequest())
    expect(res.status).toBe(200)

    const json = (await res.json()) as { offers: typeof SAMPLE_OFFERS; total: number; page: number }
    expect(json.offers).toHaveLength(2)
    expect(json.offers[0].offer_name).toBe('AI Video Editor')
    expect(json.total).toBe(2)
    expect(json.page).toBe(1)
  })

  it('pagination — page=2 applies correct offset (range called with offset=50)', async () => {
    mockRowChain = makeChain({ data: [], count: 60 })
    mockCountChain = makeChain({ data: [], count: 60 })

    const res = await GET(makeRequest({ page: '2', limit: '50' }))
    expect(res.status).toBe(200)

    const json = (await res.json()) as { page: number; total: number }
    expect(json.page).toBe(2)
    expect(json.total).toBe(60)

    // Verify range was called with offset=50 (page 2, limit 50)
    expect(mockRowChain.range).toHaveBeenCalledWith(50, 99)
  })

  it('400 when limit exceeds 100', async () => {
    const res = await GET(makeRequest({ limit: '200' }))
    expect(res.status).toBe(400)

    const json = (await res.json()) as { error: string }
    expect(json.error).toBe('Invalid query params')
  })

  it('400 when page is 0', async () => {
    const res = await GET(makeRequest({ page: '0' }))
    expect(res.status).toBe(400)

    const json = (await res.json()) as { error: string }
    expect(json.error).toBe('Invalid query params')
  })
})
