import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock Supabase before importing
vi.mock('@/lib/supabase/client', () => {
  const mockFrom = vi.fn()
  return {
    supabase: {
      from: mockFrom,
    },
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
import { supabase } from '@/lib/supabase/client'

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

  beforeEach(() => {
    vi.clearAllMocks()
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

  it('should upsert products to Supabase', async () => {
    const upsertMock = vi.fn().mockResolvedValue({ error: null })
    vi.mocked(supabase.from).mockReturnValue({
      upsert: upsertMock,
    } as ReturnType<typeof supabase.from>)

    const products = [
      createTestProduct({ external_id: 'EXT-001' }),
      createTestProduct({ external_id: 'EXT-002', title: 'Another Product' }),
    ]

    const result = await adapter.upsertProducts(products)

    expect(result.total).toBe(2)
    expect(result.processed).toBe(2)
    expect(result.failed).toBe(0)
    expect(result.errors).toEqual([])
    expect(supabase.from).toHaveBeenCalledWith('affiliate_products')
    expect(upsertMock).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          external_id: 'EXT-001',
          network_id: 'clickbank',
          sps_score: 0,
          is_hidden_gem: false,
        }),
      ]),
      { onConflict: 'network_id,external_id', ignoreDuplicates: false },
    )
  })

  it('should handle optional fields with null defaults', async () => {
    const upsertMock = vi.fn().mockResolvedValue({ error: null })
    vi.mocked(supabase.from).mockReturnValue({
      upsert: upsertMock,
    } as ReturnType<typeof supabase.from>)

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
      expect.objectContaining({}),
    )
  })

  it('should handle Supabase upsert errors', async () => {
    const upsertMock = vi.fn().mockResolvedValue({
      error: { message: 'Constraint violation' },
    })
    vi.mocked(supabase.from).mockReturnValue({
      upsert: upsertMock,
    } as ReturnType<typeof supabase.from>)

    const products = [createTestProduct()]

    const result = await adapter.upsertProducts(products)

    expect(result.total).toBe(1)
    expect(result.processed).toBe(0)
    expect(result.failed).toBe(1)
    expect(result.errors).toContain('Batch upsert failed: Constraint violation')
  })

  it('should process products in chunks of 100', async () => {
    const upsertMock = vi.fn().mockResolvedValue({ error: null })
    vi.mocked(supabase.from).mockReturnValue({
      upsert: upsertMock,
    } as ReturnType<typeof supabase.from>)

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

    vi.mocked(supabase.from).mockReturnValue({
      upsert: upsertMock,
    } as ReturnType<typeof supabase.from>)

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
