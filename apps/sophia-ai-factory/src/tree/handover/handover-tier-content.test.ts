/**
 * Tests for handover tier display content (pure data invariants).
 *
 * Pins the tier × content alignment: every Tier must have a price, feature list,
 * SLA string, and concurrent-runs label. Catches accidental tier additions
 * without matching content updates.
 */

import { describe, it, expect } from 'vitest'
import {
  TIER_PRICES,
  TIER_BILLING_TERMS,
  TIER_FEATURES,
  TIER_SUPPORT_SLA,
  TIER_CONCURRENT_RUNS,
} from './handover-tier-content'

const TIERS = ['BASIC', 'PREMIUM', 'ENTERPRISE', 'MASTER'] as const

describe('handover-tier-content', () => {
  describe('TIER_PRICES', () => {
    it('has a price string for every Tier', () => {
      for (const tier of TIERS) {
        expect(TIER_PRICES[tier]).toBeDefined()
        expect(TIER_PRICES[tier]).not.toBe('')
      }
    })

    it('formats monthly tiers as /mo and MASTER as one-time', () => {
      for (const tier of ['BASIC', 'PREMIUM', 'ENTERPRISE'] as const) {
        expect(TIER_PRICES[tier]).toMatch(/^\$[\d,]+\/mo$/)
      }
      expect(TIER_PRICES.MASTER).toBe('$4,999 one-time')
    })

    it('prices ascend across tiers (BASIC < PREMIUM < ENTERPRISE < MASTER)', () => {
      const numeric = (s: string) => parseInt(s.replace(/[^\d]/g, ''), 10)
      const basic = numeric(TIER_PRICES.BASIC)
      const premium = numeric(TIER_PRICES.PREMIUM)
      const enterprise = numeric(TIER_PRICES.ENTERPRISE)
      const master = numeric(TIER_PRICES.MASTER)
      expect(basic).toBeLessThan(premium)
      expect(premium).toBeLessThan(enterprise)
      expect(enterprise).toBeLessThan(master)
    })
  })

  describe('TIER_BILLING_TERMS', () => {
    it('uses monthly terms for subscription tiers and lifetime terms for MASTER', () => {
      expect(TIER_BILLING_TERMS.BASIC).toBe('Monthly, auto-renew')
      expect(TIER_BILLING_TERMS.PREMIUM).toBe('Monthly, auto-renew')
      expect(TIER_BILLING_TERMS.ENTERPRISE).toBe('Monthly, auto-renew')
      expect(TIER_BILLING_TERMS.MASTER).toBe('One-time, lifetime access')
    })
  })

  describe('TIER_FEATURES', () => {
    it('has a non-empty feature list for every Tier', () => {
      for (const tier of TIERS) {
        expect(Array.isArray(TIER_FEATURES[tier])).toBe(true)
        expect(TIER_FEATURES[tier].length).toBeGreaterThan(0)
      }
    })

    it('PREMIUM/ENTERPRISE/MASTER lists end with "All <prev> features" superset reference', () => {
      const last = (arr: string[]) => arr[arr.length - 1]
      expect(last(TIER_FEATURES.PREMIUM)).toMatch(/All BASIC features/i)
      expect(last(TIER_FEATURES.ENTERPRISE)).toMatch(/All PREMIUM features/i)
      expect(last(TIER_FEATURES.MASTER)).toMatch(/All ENTERPRISE features/i)
    })

    it('every feature entry is a non-empty string', () => {
      for (const tier of TIERS) {
        for (const feature of TIER_FEATURES[tier]) {
          expect(typeof feature).toBe('string')
          expect(feature.length).toBeGreaterThan(0)
        }
      }
    })
  })

  describe('TIER_SUPPORT_SLA', () => {
    it('has an SLA string for every Tier', () => {
      for (const tier of TIERS) {
        expect(TIER_SUPPORT_SLA[tier]).toBeDefined()
        expect(TIER_SUPPORT_SLA[tier]).toMatch(/hour/)
      }
    })

    it('SLA hours decrease (faster) as tier increases', () => {
      const hours = (s: string) => parseInt(s.replace(/[^\d]/g, ''), 10)
      expect(hours(TIER_SUPPORT_SLA.BASIC)).toBeGreaterThan(hours(TIER_SUPPORT_SLA.PREMIUM))
      expect(hours(TIER_SUPPORT_SLA.PREMIUM)).toBeGreaterThan(hours(TIER_SUPPORT_SLA.ENTERPRISE))
      expect(hours(TIER_SUPPORT_SLA.ENTERPRISE)).toBeGreaterThan(hours(TIER_SUPPORT_SLA.MASTER))
    })
  })

  describe('TIER_CONCURRENT_RUNS', () => {
    it('has a concurrent-runs label for every Tier', () => {
      for (const tier of TIERS) {
        expect(TIER_CONCURRENT_RUNS[tier]).toBeDefined()
        expect(TIER_CONCURRENT_RUNS[tier]).not.toBe('')
      }
    })

    it('ENTERPRISE and MASTER allow unlimited parallel runs', () => {
      expect(TIER_CONCURRENT_RUNS.ENTERPRISE).toMatch(/unlimited/i)
      expect(TIER_CONCURRENT_RUNS.MASTER).toMatch(/unlimited/i)
    })
  })

  describe('catalog completeness', () => {
    it('all four constants cover the same Tier set with no extra keys', () => {
      const constants = [TIER_PRICES, TIER_BILLING_TERMS, TIER_FEATURES, TIER_SUPPORT_SLA, TIER_CONCURRENT_RUNS]
      for (const c of constants) {
        const keys = Object.keys(c).sort()
        expect(keys).toEqual([...TIERS].sort())
      }
    })
  })
})
