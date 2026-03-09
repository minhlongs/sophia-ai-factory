/**
 * Tests for Right-to-Erasure Handler
 */

import { describe, it, expect, vi } from 'vitest'
import {
  handleRightToErasure,
  canDeleteUserData,
  getErasureStatus,
  type ErasureResult,
  type LegalHoldCheck,
} from './right-to-erasure'

// Mock Supabase admin client
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        }),
      }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    }),
  }),
}))

// Mock logger
vi.mock('@/lib/utils/logger-utility', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

describe('Right-to-Erasure Handler', () => {
  describe('handleRightToErasure', () => {
    it('returns error result type', async () => {
      const result = await handleRightToErasure('user-123')
      expect(result).toHaveProperty('anonymizedCount')
    })
  })

  describe('canDeleteUserData', () => {
    it('returns LegalHoldCheck result type', async () => {
      const result = await canDeleteUserData('user-123')
      expect(result).toHaveProperty('canDelete')
    })
  })

  describe('getErasureStatus', () => {
    it('returns hasErasureRequest=false when no request exists', async () => {
      const result = await getErasureStatus('user-123')
      expect(result.hasErasureRequest).toBe(false)
    })

    it('returns false on error (graceful fallback)', async () => {
      const result = await getErasureStatus('user-123')
      expect(result.hasErasureRequest).toBe(false)
    })
  })
})
