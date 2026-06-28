import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock D1 client before importing runner
const mockFrom = vi.fn()
vi.mock('@/seed/db/client', () => {
  return {
    createServerClient: vi.fn(() => ({
      from: mockFrom,
    })),
  }
})

// Mock scoring service
vi.mock('./scoring', () => ({
  scoringService: {
    calculateScore: vi.fn().mockReturnValue({
      sps_score: 75.5,
      is_hidden_gem: true,
      components: { commission: 60, popularity: 50, reliability: 80 },
    }),
  },
}))

import { runScoringBatch, scoreAllProducts } from './runner'
import { createServerClient } from '@/seed/db/client'
import { scoringService } from './scoring'

interface MockProduct {
  id: string
  network_id: string
  avg_earnings_usd: number
  raw_metrics: Record<string, unknown>
}

describe('runScoringBatch', () => {
  let mockDb: ReturnType<typeof createServerClient>

  beforeEach(() => {
    vi.clearAllMocks()
    mockDb = { from: mockFrom } as unknown as ReturnType<typeof createServerClient>
    vi.mocked(createServerClient).mockReturnValue(mockDb)
  })

  it('should fetch products, score them, and upsert results', async () => {
    const mockProducts: MockProduct[] = [
      {
        id: 'prod-1',
        network_id: 'clickbank',
        avg_earnings_usd: 45,
        raw_metrics: { gravity: 100 },
      },
      {
        id: 'prod-2',
        network_id: 'shareasale',
        avg_earnings_usd: 55,
        raw_metrics: { powerRank: 5 },
      },
    ]

    const selectMock = vi.fn().mockReturnValue({
      range: vi.fn().mockResolvedValue({ data: mockProducts, error: null }),
    })
    const upsertMock = vi.fn().mockResolvedValue({ error: null })

    mockFrom.mockImplementation((table: string) => {
      if (table === 'affiliate_products') {
        return {
          select: selectMock,
          upsert: upsertMock,
        }
      }
      return {}
    })

    const result = await runScoringBatch(100, 0)

    expect(result.processed).toBe(2)
    expect(result.updated).toBe(2)
    expect(scoringService.calculateScore).toHaveBeenCalledTimes(2)
    expect(upsertMock).toHaveBeenCalled()
  })

  it('should return zeros when no products found', async () => {
    const selectMock = vi.fn().mockReturnValue({
      range: vi.fn().mockResolvedValue({ data: [], error: null }),
    })

    mockFrom.mockReturnValue({
      select: selectMock,
    })

    const result = await runScoringBatch(100, 0)

    expect(result.processed).toBe(0)
    expect(result.updated).toBe(0)
  })

  it('should return zeros when data is null', async () => {
    const selectMock = vi.fn().mockReturnValue({
      range: vi.fn().mockResolvedValue({ data: null, error: null }),
    })

    mockFrom.mockReturnValue({
      select: selectMock,
    })

    const result = await runScoringBatch(100, 0)

    expect(result.processed).toBe(0)
    expect(result.updated).toBe(0)
  })

  it('should throw when fetch fails', async () => {
    const selectMock = vi.fn().mockReturnValue({
      range: vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Database connection error' },
      }),
    })

    mockFrom.mockReturnValue({
      select: selectMock,
    })

    await expect(runScoringBatch(100, 0)).rejects.toThrow(
      'Failed to fetch products for scoring: Database connection error',
    )
  })

  it('should throw when upsert fails', async () => {
    const mockProducts: MockProduct[] = [
      {
        id: 'prod-1',
        network_id: 'clickbank',
        avg_earnings_usd: 45,
        raw_metrics: { gravity: 100 },
      },
    ]

    const selectMock = vi.fn().mockReturnValue({
      range: vi.fn().mockResolvedValue({ data: mockProducts, error: null }),
    })
    const upsertMock = vi.fn().mockResolvedValue({
      error: { message: 'Upsert constraint violation' },
    })

    mockFrom.mockReturnValue({
      select: selectMock,
      upsert: upsertMock,
    })

    await expect(runScoringBatch(100, 0)).rejects.toThrow(
      'Bulk update failed: Upsert constraint violation',
    )
  })
})

describe('scoreAllProducts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(createServerClient).mockReturnValue({ from: mockFrom } as unknown as ReturnType<typeof createServerClient>)
  })

  it('should process multiple batches until all products scored', async () => {
    // First batch: 500 products (full batch = more to process)
    // Second batch: 200 products (partial = done)
    let callCount = 0

    const selectMock = vi.fn().mockReturnValue({
      range: vi.fn().mockImplementation(() => {
        callCount++
        const batchSize = callCount === 1 ? 500 : 200
        const products: MockProduct[] = Array.from({ length: batchSize }, (_, i) => ({
          id: `prod-${callCount}-${i}`,
          network_id: 'clickbank' as const,
          avg_earnings_usd: 50,
          raw_metrics: { gravity: 100 },
        }))
        return Promise.resolve({ data: products, error: null })
      }),
    })
    const upsertMock = vi.fn().mockResolvedValue({ error: null })

    mockFrom.mockReturnValue({
      select: selectMock,
      upsert: upsertMock,
    })

    const result = await scoreAllProducts()

    expect(result.total).toBe(700) // 500 + 200
  })

  it('should stop when batch returns zero products', async () => {
    const selectMock = vi.fn().mockReturnValue({
      range: vi.fn().mockResolvedValue({ data: [], error: null }),
    })

    mockFrom.mockReturnValue({
      select: selectMock,
    })

    const result = await scoreAllProducts()

    expect(result.total).toBe(0)
  })
})
