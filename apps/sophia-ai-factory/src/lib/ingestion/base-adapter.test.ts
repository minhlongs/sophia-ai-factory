import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock D1 client before importing
const mockFrom = vi.fn()
vi.mock('@/seed/db/client', () => {
  return {
    createServerClient: vi.fn(() => ({
      from: mockFrom,
    })),
  }
})

// Mock Bottleneck as a class constructor
vi.mock('bottleneck', () => {
  return {
    default: class MockBottleneck {
      constructor() {
        // no-op
      }
    },
  }
})

import { BaseAdapter } from './base-adapter'
import type { RawProduct } from './types'
import { createServerClient } from '@/seed/db/client'

// Concrete test implementation of the abstract BaseAdapter
class TestAdapter extends BaseAdapter {
  networkId = 'clickbank' as const
  fetchedProducts: RawProduct[] = []

  async fetchProducts(): Promise<RawProduct[]> {
    return this.fetchedProducts
  }
}

function createTestProduct(overrides?: Partial<RawProduct>): RawProduct {
  return {
    external_id: 'EXT-001',
    network_id: 'clickbank',
    title: 'Test Product',
    affiliate_link: 'https://example.com/aff/1',
    raw_metrics: { gravity: 50 },
    ...overrides,
  }
}

describe('BaseAdapter.upsertProducts', () => {
  let adapter: TestAdapter
  let mockDb: ReturnType<typeof createServerClient>

  beforeEach(() => {
    vi.clearAllMocks()
    mockDb = { from: mockFrom } as unknown as ReturnType<typeof createServerClient>
    vi.mocked(createServerClient).mockReturnValue(mockDb)
    adapter = new TestAdapter()
  })

  it('should return zero counts for empty products array', async () => {
    const result = await adapter.upsertProducts([])

    expect(result.total).toBe(0)
    expect(result.processed).toBe(0)
    expect(result.skipped).toBe(0)
    expect(result.failed).toBe(0)
    expect(result.errors).toEqual([])
  })

  it('should upsert products to D1', async () => {
    const upsertMock = vi.fn().mockResolvedValue({ error: null })
    mockFrom.mockReturnValue({
      upsert: upsertMock,
    })

    const products = [
      createTestProduct({ external_id: 'EXT-001' }),
      createTestProduct({ external_id: 'EXT-002', title: 'Another Product' }),
    ]

    const result = await adapter.upsertProducts(products)

    expect(result.total).toBe(2)
    expect(result.processed).toBe(2)
    expect(result.failed).toBe(0)
    expect(result.errors).toEqual([])
    expect(mockFrom).toHaveBeenCalledWith('affiliate_products')
    // upsert is called with rows only — the Supabase-style 2nd arg
    // ({ onConflict, ignoreDuplicates }) was always silently dropped by
    // D1Client.upsert and the production code no longer passes it.
    expect(upsertMock).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          external_id: 'EXT-001',
          network_id: 'clickbank',
          sps_score: 0,
          is_hidden_gem: false,
        }),
      ]),
    )
  })

  it('should handle optional fields with null defaults', async () => {
    const upsertMock = vi.fn().mockResolvedValue({ error: null })
    mockFrom.mockReturnValue({
      upsert: upsertMock,
    })

    const product = createTestProduct({
      description: undefined,
      thumbnail_url: undefined,
      price_usd: undefined,
      commission_rate: undefined,
      avg_earnings_usd: undefined,
      category_id: undefined,
    })

    await adapter.upsertProducts([product])

    expect(upsertMock).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          description: null,
          thumbnail_url: null,
          price_usd: null,
          commission_rate: null,
          avg_earnings_usd: null,
          category_id: null,
        }),
      ]),
    )
  })

  it('should handle upsert errors', async () => {
    const upsertMock = vi.fn().mockResolvedValue({
      error: { message: 'Constraint violation' },
    })
    mockFrom.mockReturnValue({
      upsert: upsertMock,
    })

    const products = [createTestProduct()]

    const result = await adapter.upsertProducts(products)

    expect(result.total).toBe(1)
    expect(result.processed).toBe(0)
    expect(result.failed).toBe(1)
    expect(result.errors).toContain('Batch upsert failed: Constraint violation')
  })

  it('should process products in chunks of 100', async () => {
    const upsertMock = vi.fn().mockResolvedValue({ error: null })
    mockFrom.mockReturnValue({
      upsert: upsertMock,
    })

    // Create 250 products - should result in 3 upsert calls (100 + 100 + 50)
    const products = Array.from({ length: 250 }, (_, i) =>
      createTestProduct({ external_id: `EXT-${i}` }),
    )

    const result = await adapter.upsertProducts(products)

    expect(result.total).toBe(250)
    expect(result.processed).toBe(250)
    expect(upsertMock).toHaveBeenCalledTimes(3)
  })

  it('should continue processing chunks even if one fails', async () => {
    const upsertMock = vi.fn()
      .mockResolvedValueOnce({ error: { message: 'First batch failed' } })
      .mockResolvedValueOnce({ error: null })

    mockFrom.mockReturnValue({
      upsert: upsertMock,
    })

    // Create 150 products - 2 chunks (100 + 50)
    const products = Array.from({ length: 150 }, (_, i) =>
      createTestProduct({ external_id: `EXT-${i}` }),
    )

    const result = await adapter.upsertProducts(products)

    expect(result.total).toBe(150)
    expect(result.processed).toBe(50) // Second chunk succeeded
    expect(result.failed).toBe(100) // First chunk failed
    expect(result.errors).toHaveLength(1)
  })
})
