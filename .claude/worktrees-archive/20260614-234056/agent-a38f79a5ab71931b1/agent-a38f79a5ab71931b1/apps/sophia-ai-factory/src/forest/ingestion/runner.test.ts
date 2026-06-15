import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { IngestionResult, RawProduct } from './types'

const mockFetchProductsCB = vi.fn()
const mockUpsertProductsCB = vi.fn()
const mockFetchProductsSAS = vi.fn()
const mockUpsertProductsSAS = vi.fn()

// Mock the adapter modules before importing runner
vi.mock('./adapters/clickbank-adapter', () => ({
  ClickbankAdapter: class MockClickbankAdapter {
    fetchProducts = mockFetchProductsCB
    upsertProducts = mockUpsertProductsCB
  },
}))

vi.mock('./adapters/shareasale-adapter', () => ({
  ShareasaleAdapter: class MockShareasaleAdapter {
    fetchProducts = mockFetchProductsSAS
    upsertProducts = mockUpsertProductsSAS
  },
}))

import { runIngestion } from './runner'

const mockProduct: RawProduct = {
  external_id: 'PROD-1',
  network_id: 'clickbank',
  title: 'Test Product',
  affiliate_link: 'https://example.com',
  raw_metrics: { gravity: 100 },
}

const successResult: IngestionResult = {
  total: 1,
  processed: 1,
  skipped: 0,
  failed: 0,
  errors: [],
}

describe('runIngestion', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should run clickbank ingestion by default', async () => {
    mockFetchProductsCB.mockResolvedValue([mockProduct])
    mockUpsertProductsCB.mockResolvedValue(successResult)
    mockFetchProductsSAS.mockResolvedValue([])
    mockUpsertProductsSAS.mockResolvedValue({
      total: 0, processed: 0, skipped: 0, failed: 0, errors: [],
    })

    const results = await runIngestion()

    expect(results['clickbank']).toEqual(successResult)
    expect(mockFetchProductsCB).toHaveBeenCalled()
    expect(mockUpsertProductsCB).toHaveBeenCalledWith([mockProduct])
  })

  it('should run shareasale ingestion by default', async () => {
    mockFetchProductsCB.mockResolvedValue([])
    mockUpsertProductsCB.mockResolvedValue({
      total: 0, processed: 0, skipped: 0, failed: 0, errors: [],
    })
    mockFetchProductsSAS.mockResolvedValue([
      { ...mockProduct, network_id: 'shareasale' },
    ])
    mockUpsertProductsSAS.mockResolvedValue(successResult)

    const results = await runIngestion()

    expect(results['shareasale']).toEqual(successResult)
    expect(mockFetchProductsSAS).toHaveBeenCalled()
  })

  it('should only run specified networks', async () => {
    mockFetchProductsCB.mockResolvedValue([mockProduct])
    mockUpsertProductsCB.mockResolvedValue(successResult)

    const results = await runIngestion(['clickbank'])

    expect(results['clickbank']).toEqual(successResult)
    expect(results['shareasale']).toBeUndefined()
    expect(mockFetchProductsSAS).not.toHaveBeenCalled()
  })

  it('should handle clickbank fetch failure', async () => {
    mockFetchProductsCB.mockRejectedValue(new Error('ClickBank API down'))
    mockFetchProductsSAS.mockResolvedValue([])
    mockUpsertProductsSAS.mockResolvedValue({
      total: 0, processed: 0, skipped: 0, failed: 0, errors: [],
    })

    const results = await runIngestion()

    expect(results['clickbank'].errors).toContain('ClickBank API down')
    expect(results['clickbank'].total).toBe(0)
  })

  it('should handle shareasale fetch failure', async () => {
    mockFetchProductsCB.mockResolvedValue([])
    mockUpsertProductsCB.mockResolvedValue({
      total: 0, processed: 0, skipped: 0, failed: 0, errors: [],
    })
    mockFetchProductsSAS.mockRejectedValue(new Error('ShareASale timeout'))

    const results = await runIngestion()

    expect(results['shareasale'].errors).toContain('ShareASale timeout')
    expect(results['shareasale'].total).toBe(0)
  })

  it('should handle empty network list', async () => {
    const results = await runIngestion([])

    expect(Object.keys(results)).toHaveLength(0)
  })

  it('should run both networks independently', async () => {
    mockFetchProductsCB.mockResolvedValue([mockProduct])
    mockUpsertProductsCB.mockResolvedValue({
      total: 1, processed: 1, skipped: 0, failed: 0, errors: [],
    })
    mockFetchProductsSAS.mockRejectedValue(new Error('SAS error'))

    const results = await runIngestion(['clickbank', 'shareasale'])

    // Clickbank should succeed even though ShareASale failed
    expect(results['clickbank'].processed).toBe(1)
    expect(results['shareasale'].errors).toContain('SAS error')
  })
})
