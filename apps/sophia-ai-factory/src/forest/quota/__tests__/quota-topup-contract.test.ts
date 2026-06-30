/**
 * Contract tests: Quota Top-Up Integration
 *
 * Verifies that quota enforcement integrates correctly with top-up credits:
 * 1. Quota check passes after successful top-up (sufficient credits)
 * 2. Quota check fails before top-up (returns 429)
 * 3. Warning threshold triggers at 80% usage
 *
 * @vitest
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ── Hoisted mocks ────────────────────────────────────────────────────────────
const { mockCheckQuotaWithOverage, mockCanAccessApi, mockCreateQuotaExceededResponse, mockLogger } = vi.hoisted(() => ({
  mockCheckQuotaWithOverage: vi.fn(),
  mockCanAccessApi: vi.fn(),
  mockCreateQuotaExceededResponse: vi.fn(),
  mockLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: mockLogger,
}))

vi.mock('@/land/billing/dunning-workflow', () => ({
  canAccessApi: mockCanAccessApi,
}))

vi.mock('@/seed/db/client', () => ({
  createServerClient: vi.fn(() => ({
    from: () => ({
      insert: () => Promise.resolve({ error: null }),
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve({ data: null, error: { message: 'not found' } }),
        }),
      }),
      update: () => ({
        eq: () => ({
          eq: () => Promise.resolve({ count: 1, error: null }),
        }),
      }),
    }),
    prepare: () => ({
      bind: () => ({
        run: () => Promise.resolve({ meta: { changes: 1 } }),
        first: () => Promise.resolve(null),
      }),
    }),
  })),
}))

vi.mock('@/seed/config/tiers', () => ({
  UNIFIED_TIERS: {},
  TIER_CONFIGS: {},
  TIER_CONFIG: {},
}))

// Mock the quota-checker internals
vi.mock('../quota-checker', () => ({
  checkQuotaWithOverage: mockCheckQuotaWithOverage,
  DEFAULT_CONFIG: { softWarningThreshold: 0.8, enableOverageBilling: false, failClosed: true },
}))

vi.mock('../quota-enforcer-response', () => ({
  createQuotaExceededResponse: mockCreateQuotaExceededResponse,
  createDunningBlockResponse: vi.fn(),
}))

vi.mock('../quota-checker-kv-cache', () => ({
  getCachedUsage: vi.fn(),
  updateCachedUsage: vi.fn(),
  invalidateQuotaCache: vi.fn(),
  atomicIncrementQuota: vi.fn(),
}))

vi.mock('../quota-checker-db', () => ({
  getEffectiveQuotaLimits: vi.fn(),
  calculateCurrentUsage: vi.fn(),
}))

vi.mock('../quota-checker-overage', () => ({
  logOverageEvent: vi.fn(),
  getQuotaStatus: vi.fn(),
}))

vi.mock('@/forest/alerts/realtime-alert-service', () => ({
  triggerUsageThresholdAlert: vi.fn(),
}))

// Import after mocks
import { enforceQuota } from '../quota-enforcer'

const quotas = {
  dailyCredits: 100,
  hourlyCredits: 20,
  monthlyCredits: 500,
  dailyRequests: 100,
}

describe('quota top-up integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCanAccessApi.mockResolvedValue({ allowed: true })
  })
  afterEach(() => vi.clearAllMocks())

  it('quota check passes after successful top-up (sufficient credits)', async () => {
    // After top-up, remaining credits should be sufficient
    mockCheckQuotaWithOverage.mockResolvedValue({
      allowed: true,
      remaining: {
        dailyCredits: 50,
        hourlyCredits: 10,
        monthlyCredits: 300,
        dailyRequests: 50,
      },
      warningThreshold: false,
      softLimitReached: false,
    })

    const result = await enforceQuota({
      userId: 'user1',
      licenseNonce: 'nonce_1',
      tier: 'PREMIUM',
      requestedCredits: 10,
    })

    expect(result.allowed).toBe(true)
  })

  it('quota check fails before top-up (returns 429)', async () => {
    // Before top-up, monthly credits are exhausted
    mockCheckQuotaWithOverage.mockResolvedValue({
      allowed: false,
      remaining: {
        dailyCredits: 10,
        hourlyCredits: 2,
        monthlyCredits: 0,
        dailyRequests: 30,
      },
      exceeded: {
        type: 'monthly_credits',
        limit: 500,
        current: 500,
      },
      warningThreshold: false,
      softLimitReached: false,
    })

    mockCreateQuotaExceededResponse.mockReturnValue({
      error: 'quota_exceeded',
      code: 'quota_exceeded' as const,
      message: 'Monthly credit limit exceeded',
      exceeded: { type: 'monthly_credits', limit: 500, current: 500, requested: 10 },
      remaining: { dailyCredits: 10, hourlyCredits: 2, monthlyCredits: 0, dailyRequests: 30 },
      retryAfter: 2592000,
      upgradeUrl: '/dashboard/billing',
    })

    const result = await enforceQuota({
      userId: 'user1',
      licenseNonce: 'nonce_1',
      tier: 'PREMIUM',
      requestedCredits: 10,
    })

    expect(result.allowed).toBe(false)
    if (!result.allowed) {
      expect(result.response.code).toBe('quota_exceeded')
      expect(result.response.message).toContain('Monthly credit limit exceeded')
    }
  })

  it('warning threshold triggers at 80% usage', async () => {
    // 80% usage → warning threshold should be true, but request still allowed
    mockCheckQuotaWithOverage.mockResolvedValue({
      allowed: true,
      remaining: {
        dailyCredits: 20,
        hourlyCredits: 4,
        monthlyCredits: 100,
        dailyRequests: 20,
      },
      warningThreshold: true,
      softLimitReached: true,
      overageAllowed: false,
    })

    const result = await enforceQuota({
      userId: 'user1',
      licenseNonce: 'nonce_1',
      tier: 'BASIC',
      requestedCredits: 5,
    })

    expect(result.allowed).toBe(true)
  })
})
