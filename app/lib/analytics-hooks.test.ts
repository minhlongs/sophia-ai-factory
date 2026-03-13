/* eslint-disable @typescript-eslint/no-explicit-any -- Test mock data */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import {
  useRevenueMetrics,
  useSubscriptionMetrics,
  useLicenseHealth,
  useAllAnalytics,
} from './analytics-hooks'

// Mock LicenseService
vi.mock('./license-service', () => ({
  LicenseService: {
    getAll: vi.fn(),
    getStats: vi.fn(),
  },
}))

// Mock UsageMetering
vi.mock('./usage-metering', () => ({
  UsageMetering: {
    getUsage: vi.fn(),
  },
}))

import { LicenseService } from './license-service'

describe('analytics-hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('useRevenueMetrics', () => {
    it('should return zero metrics when no licenses', () => {
      vi.mocked(LicenseService.getAll).mockReturnValue([])

      const { result } = renderHook(() => useRevenueMetrics())

      expect(result.current).toEqual({
        mrr: 0,
        arr: 0,
        totalRevenue: 0,
        byTier: { FREE: 0, PRO: 0, ENTERPRISE: 0, MASTER: 0 },
      })
    })

    it('should calculate MRR from active PRO licenses', () => {
      vi.mocked(LicenseService.getAll).mockReturnValue([
        {
          id: 'lic_1',
          customerId: 'cust_1',
          tier: 'PRO',
          status: 'active',
          subscriptionStatus: 'active',
          features: [],
        },
        {
          id: 'lic_2',
          customerId: 'cust_2',
          tier: 'PRO',
          status: 'active',
          subscriptionStatus: 'active',
          features: [],
        },
      ] as any)

      const { result } = renderHook(() => useRevenueMetrics())

      expect(result.current.mrr).toBe(98) // 49 * 2
      expect(result.current.arr).toBe(1176) // 98 * 12
    })

    it('should calculate MRR from mixed tiers', () => {
      vi.mocked(LicenseService.getAll).mockReturnValue([
        { id: 'lic_1', customerId: 'cust_1', tier: 'FREE', status: 'active', subscriptionStatus: undefined, features: [] },
        { id: 'lic_2', customerId: 'cust_2', tier: 'PRO', status: 'active', subscriptionStatus: 'active', features: [] },
        { id: 'lic_3', customerId: 'cust_3', tier: 'ENTERPRISE', status: 'active', subscriptionStatus: 'active', features: [] },
        { id: 'lic_4', customerId: 'cust_4', tier: 'MASTER', status: 'active', subscriptionStatus: 'active', features: [] },
      ] as any)

      const { result } = renderHook(() => useRevenueMetrics())

      expect(result.current.mrr).toBe(697) // 0 + 49 + 149 + 499
      expect(result.current.byTier.FREE).toBe(0)
      expect(result.current.byTier.PRO).toBe(49)
      expect(result.current.byTier.ENTERPRISE).toBe(149)
      expect(result.current.byTier.MASTER).toBe(499)
    })

    it('should only count active licenses', () => {
      vi.mocked(LicenseService.getAll).mockReturnValue([
        { id: 'lic_1', tier: 'PRO', status: 'active', subscriptionStatus: 'active', features: [] },
        { id: 'lic_2', tier: 'PRO', status: 'revoked', subscriptionStatus: undefined, features: [] },
      ] as any)

      const { result } = renderHook(() => useRevenueMetrics())

      expect(result.current.mrr).toBe(49)
    })

    it('should return zero metrics on error', () => {
      vi.mocked(LicenseService.getAll).mockImplementation(() => {
        throw new Error('Test error')
      })

      const { result } = renderHook(() => useRevenueMetrics())

      expect(result.current).toEqual({
        mrr: 0,
        arr: 0,
        totalRevenue: 0,
        byTier: { FREE: 0, PRO: 0, ENTERPRISE: 0, MASTER: 0 },
      })
    })
  })

  describe('useSubscriptionMetrics', () => {
    it('should return zero metrics when no licenses', () => {
      vi.mocked(LicenseService.getAll).mockReturnValue([])

      const { result } = renderHook(() => useSubscriptionMetrics())

      expect(result.current).toEqual({
        activeSubscriptions: 0,
        churnRate: 0,
        uncancelledSubscriptions: 0,
        cancelledSubscriptions: 0,
      })
    })

    it('should count active subscriptions', () => {
      vi.mocked(LicenseService.getAll).mockReturnValue([
        { id: 'lic_1', subscriptionStatus: 'active' },
        { id: 'lic_2', subscriptionStatus: 'active' },
        { id: 'lic_3', subscriptionStatus: 'cancelled' },
      ] as any)

      const { result } = renderHook(() => useSubscriptionMetrics())

      expect(result.current.activeSubscriptions).toBe(2)
      expect(result.current.cancelledSubscriptions).toBe(1)
    })

    it('should count uncancelled subscriptions', () => {
      vi.mocked(LicenseService.getAll).mockReturnValue([
        { id: 'lic_1', subscriptionStatus: 'uncancelled' },
        { id: 'lic_2', subscriptionStatus: 'uncancelled' },
      ] as any)

      const { result } = renderHook(() => useSubscriptionMetrics())

      expect(result.current.uncancelledSubscriptions).toBe(2)
    })

    it('should calculate churn rate', () => {
      vi.mocked(LicenseService.getAll).mockReturnValue([
        { id: 'lic_1', subscriptionStatus: 'active' },
        { id: 'lic_2', subscriptionStatus: 'active' },
        { id: 'lic_3', subscriptionStatus: 'cancelled' },
      ] as any)

      const { result } = renderHook(() => useSubscriptionMetrics())

      // churnRate = cancelled / (active + cancelled) = 1 / 3 = 33%
      expect(result.current.churnRate).toBe(33)
    })

    it('should return zero churn rate when no subscriptions', () => {
      vi.mocked(LicenseService.getAll).mockReturnValue([])

      const { result } = renderHook(() => useSubscriptionMetrics())

      expect(result.current.churnRate).toBe(0)
    })

    it('should return zero metrics on error', () => {
      vi.mocked(LicenseService.getAll).mockImplementation(() => {
        throw new Error('Test error')
      })

      const { result } = renderHook(() => useSubscriptionMetrics())

      expect(result.current).toEqual({
        activeSubscriptions: 0,
        churnRate: 0,
        uncancelledSubscriptions: 0,
        cancelledSubscriptions: 0,
      })
    })
  })

  describe('useLicenseHealth', () => {
    it('should return health metrics from LicenseService', () => {
      vi.mocked(LicenseService.getStats).mockReturnValue({
        total: 100,
        byStatus: {
          active: 80,
          revoked: 10,
          expired: 10,
        },
      } as any)

      const { result } = renderHook(() => useLicenseHealth())

      expect(result.current).toEqual({
        total: 100,
        active: 80,
        revoked: 10,
        expired: 10,
        healthScore: 80, // 80/100 * 100 = 80
      })
    })

    it('should return 100 health score when total is 0', () => {
      vi.mocked(LicenseService.getStats).mockReturnValue({
        total: 0,
        byStatus: { active: 0, revoked: 0, expired: 0 },
      } as any)

      const { result } = renderHook(() => useLicenseHealth())

      expect(result.current.healthScore).toBe(100)
    })

    it('should return zero metrics on error', () => {
      vi.mocked(LicenseService.getStats).mockImplementation(() => {
        throw new Error('Test error')
      })

      const { result } = renderHook(() => useLicenseHealth())

      expect(result.current).toEqual({
        total: 0,
        active: 0,
        revoked: 0,
        expired: 0,
        healthScore: 100,
      })
    })
  })

  describe('useAllAnalytics', () => {
    it('should return all metrics combined', () => {
      vi.mocked(LicenseService.getAll).mockReturnValue([])
      vi.mocked(LicenseService.getStats).mockReturnValue({
        total: 100,
        byStatus: { active: 80, revoked: 10, expired: 10 },
      } as any)

      const { result } = renderHook(() => useAllAnalytics())

      expect(result.current).toHaveProperty('revenue')
      expect(result.current).toHaveProperty('subscription')
      expect(result.current).toHaveProperty('health')
      expect(result.current.revenue.mrr).toBe(0)
      expect(result.current.subscription.activeSubscriptions).toBe(0)
      expect(result.current.health.total).toBe(100)
    })
  })
})
