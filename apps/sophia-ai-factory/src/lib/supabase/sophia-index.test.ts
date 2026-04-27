import { describe, it, expect, vi, beforeEach } from 'vitest'
import { sophiaIndex } from './sophia-index'
import { supabase } from './client'

// Mock supabase client
vi.mock('./client', () => ({
  supabase: {
    from: vi.fn(),
  },
}))

describe('sophiaIndex', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // Helper to create a chainable mock builder
  interface MockQueryResult {
    data: unknown;
    error: null | { message: string };
  }
  interface MockBuilder {
    select: ReturnType<typeof vi.fn>;
    order: ReturnType<typeof vi.fn>;
    limit: ReturnType<typeof vi.fn>;
    eq: ReturnType<typeof vi.fn>;
    gte: ReturnType<typeof vi.fn>;
    textSearch: ReturnType<typeof vi.fn>;
    ilike: ReturnType<typeof vi.fn>;
    single: ReturnType<typeof vi.fn>;
    then: (resolve: (value: unknown) => unknown) => Promise<unknown>;
  }
  const createMockBuilder = (result: MockQueryResult = { data: [], error: null }): MockBuilder => {
    const builder: MockBuilder = {
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      textSearch: vi.fn().mockReturnThis(),
      ilike: vi.fn().mockReturnThis(),
      single: vi.fn().mockReturnThis(),
      then: (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve)
    }
    return builder
  }

  describe('getTop50', () => {
    it('should query top 50 products ordered by sps_score', async () => {
      const mockBuilder = createMockBuilder()
      vi.mocked(supabase.from).mockReturnValue(mockBuilder as unknown as ReturnType<typeof supabase.from>)

      await sophiaIndex.getTop50()

      expect(supabase.from).toHaveBeenCalledWith('affiliate_products')
      expect(mockBuilder.select).toHaveBeenCalledWith('*')
      expect(mockBuilder.order).toHaveBeenCalledWith('sps_score', { ascending: false })
      expect(mockBuilder.limit).toHaveBeenCalledWith(50)
    })

    it('should apply filters if provided', async () => {
      const mockBuilder = createMockBuilder()
      vi.mocked(supabase.from).mockReturnValue(mockBuilder as unknown as ReturnType<typeof supabase.from>)

      await sophiaIndex.getTop50({
        category: 1,
        minCommission: 0.5,
        hiddenGemsOnly: true
      })

      expect(mockBuilder.eq).toHaveBeenCalledWith('category_id', 1)
      expect(mockBuilder.gte).toHaveBeenCalledWith('commission_rate', 0.5)
      expect(mockBuilder.eq).toHaveBeenCalledWith('is_hidden_gem', true)
    })
  })

  describe('search', () => {
    it('should search products by title', async () => {
      const mockBuilder = createMockBuilder()
      vi.mocked(supabase.from).mockReturnValue(mockBuilder as unknown as ReturnType<typeof supabase.from>)

      await sophiaIndex.search('keto')

      expect(mockBuilder.ilike).toHaveBeenCalledWith('title', '%keto%')
      expect(mockBuilder.limit).toHaveBeenCalledWith(20)
    })
  })

  describe('getById', () => {
    it('should get product by id', async () => {
      const mockBuilder = createMockBuilder({ data: {}, error: null })
      vi.mocked(supabase.from).mockReturnValue(mockBuilder as unknown as ReturnType<typeof supabase.from>)

      await sophiaIndex.getById('123')

      expect(mockBuilder.eq).toHaveBeenCalledWith('id', '123')
      expect(mockBuilder.single).toHaveBeenCalled()
    })
  })

  describe('getCategories', () => {
    it('should get all categories ordered by name', async () => {
      const mockBuilder = createMockBuilder()
      vi.mocked(supabase.from).mockReturnValue(mockBuilder as unknown as ReturnType<typeof supabase.from>)

      await sophiaIndex.getCategories()

      expect(supabase.from).toHaveBeenCalledWith('affiliate_categories')
      expect(mockBuilder.order).toHaveBeenCalledWith('name')
    })
  })
})
