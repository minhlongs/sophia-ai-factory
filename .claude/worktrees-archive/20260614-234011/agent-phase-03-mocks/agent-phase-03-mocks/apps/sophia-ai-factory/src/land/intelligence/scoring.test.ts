import { describe, it, expect } from 'vitest'
import { ScoringService } from './scoring'
import type { ScorableProduct } from './types'
import { normalizeClickBankGravity, normalizeShareASaleRank } from './normalization'

describe('ScoringService', () => {
  const service = new ScoringService()

  describe('Normalization', () => {
    it('should normalize ClickBank gravity correctly', () => {
      expect(normalizeClickBankGravity(0)).toBe(0)
      expect(normalizeClickBankGravity(1)).toBeGreaterThan(0)
      expect(normalizeClickBankGravity(50)).toBeGreaterThan(50) // ~63
      expect(normalizeClickBankGravity(500)).toBeCloseTo(100, 0)
    })

    it('should normalize ShareASale rank correctly', () => {
      expect(normalizeShareASaleRank(1)).toBeGreaterThan(99)
      expect(normalizeShareASaleRank(100)).toBe(90)
      expect(normalizeShareASaleRank(1000)).toBeCloseTo(50, 0)
      expect(normalizeShareASaleRank(5000)).toBe(0)
    })
  })

  describe('calculateScore', () => {
    it('should score a high value ClickBank product', () => {
      const product: ScorableProduct = {
        network_id: 'clickbank',
        avg_earnings_usd: 150, // Max commission score (100)
        raw_metrics: {
          gravity: 100, // Good gravity (~74)
          totalRebillAmt: 10 // Reliability boost (80)
        }
      }

      // Expected:
      // Comm: 100 * 0.4 = 40
      // Pop: 74 * 0.3 = 22.2
      // Rel: 80 * 0.3 = 24
      // Total: ~86.2

      const result = service.calculateScore(product)
      expect(result.sps_score).toBeGreaterThan(80)
      expect(result.components.commission).toBe(100)
    })

    it('should identify a Hidden Gem', () => {
      const product: ScorableProduct = {
        network_id: 'clickbank',
        avg_earnings_usd: 80, // Good commission (~53 score)
        raw_metrics: {
          gravity: 30, // Moderate gravity (~55 score) -> Not saturated
          totalRebillAmt: 10
        }
      }

      const result = service.calculateScore(product)
      expect(result.is_hidden_gem).toBe(true)
    })

    it('should NOT mark a saturated product as Hidden Gem', () => {
      const product: ScorableProduct = {
        network_id: 'clickbank',
        avg_earnings_usd: 150,
        raw_metrics: {
          gravity: 600, // Saturated (100 score)
          totalRebillAmt: 10
        }
      }

      const result = service.calculateScore(product)
      expect(result.is_hidden_gem).toBe(false)
    })
  })
})
