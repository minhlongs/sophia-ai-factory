/**
 * Tests for GDPR right-to-erasure legal hold (Article 17).
 *
 * Pins the 4-gate deletion check: active legal hold → block, SOC 2 90-day
 * retention from first audit log → block, active subscription → block,
 * none → allow. Plus exception handling that fail-CLOSED (default to deny).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const { mockCreateServerClient } = vi.hoisted(() => ({
  mockCreateServerClient: vi.fn(),
}))
vi.mock('@/seed/db/client', () => ({
  getD1: vi.fn(),
  createServerClient: mockCreateServerClient,
}))

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

import { canDeleteUserData } from './right-to-erasure-legal-hold'

const FIXED_NOW = new Date('2026-05-11T00:00:00Z')
const FIXED_NOW_MS = FIXED_NOW.getTime()
const MS_PER_DAY = 24 * 60 * 60 * 1000

interface QueryResult<T> {
  data: T | null
  error: { message: string } | null
}

interface MockDbOpts {
  userMeta?: QueryResult<{ raw_user_meta_data: unknown }>
  firstLog?: QueryResult<{ created_at: number }>
}

function makeMockDb(opts: MockDbOpts) {
  // Each db.from() call returns a chainable builder that resolves to .single()
  return {
    from: (table: string) => {
      const result =
        table === 'auth.users'
          ? opts.userMeta ?? { data: null, error: null }
          : opts.firstLog ?? { data: null, error: null }
      const builder = {
        select: () => builder,
        eq: () => builder,
        order: () => builder,
        limit: () => builder,
        single: async () => result,
      }
      return builder
    },
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers()
  vi.setSystemTime(FIXED_NOW)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('canDeleteUserData — gate 1: legal hold metadata', () => {
  it('blocks when raw_user_meta_data.legalHold.active === true', async () => {
    mockCreateServerClient.mockReturnValue(
      makeMockDb({
        userMeta: {
          data: { raw_user_meta_data: { legalHold: { active: true, until: 9999 } } },
          error: null,
        },
      }),
    )

    const result = await canDeleteUserData('user-1')

    expect(result).toEqual({
      canDelete: false,
      reason: 'Active legal hold',
      legalHoldUntil: 9999,
    })
  })

  it('returns undefined legalHoldUntil when until field absent', async () => {
    mockCreateServerClient.mockReturnValue(
      makeMockDb({
        userMeta: {
          data: { raw_user_meta_data: { legalHold: { active: true } } },
          error: null,
        },
      }),
    )

    const result = await canDeleteUserData('user-1')

    expect(result.canDelete).toBe(false)
    expect(result.legalHoldUntil).toBeUndefined()
  })

  it('does NOT block when legalHold.active === false (proceeds to next gates)', async () => {
    mockCreateServerClient.mockReturnValue(
      makeMockDb({
        userMeta: {
          data: { raw_user_meta_data: { legalHold: { active: false } } },
          error: null,
        },
      }),
    )

    const result = await canDeleteUserData('user-1')

    expect(result.canDelete).toBe(true)
  })
})

describe('canDeleteUserData — gate 2: SOC 2 90-day retention', () => {
  it('blocks when first audit log is younger than MIN_RETENTION_DAYS', async () => {
    const firstLogCreatedAt = FIXED_NOW_MS - 30 * MS_PER_DAY // 30 days ago
    mockCreateServerClient.mockReturnValue(
      makeMockDb({
        userMeta: { data: { raw_user_meta_data: {} }, error: null },
        firstLog: { data: { created_at: firstLogCreatedAt }, error: null },
      }),
    )

    const result = await canDeleteUserData('user-1')

    expect(result.canDelete).toBe(false)
    expect(result.reason).toMatch(/SOC 2 retention period active.*90 days/)
    expect(result.legalHoldUntil).toBe(firstLogCreatedAt + 90 * MS_PER_DAY)
  })

  it('allows when first audit log is older than MIN_RETENTION_DAYS', async () => {
    const firstLogCreatedAt = FIXED_NOW_MS - 91 * MS_PER_DAY // 91 days ago
    mockCreateServerClient.mockReturnValue(
      makeMockDb({
        userMeta: { data: { raw_user_meta_data: {} }, error: null },
        firstLog: { data: { created_at: firstLogCreatedAt }, error: null },
      }),
    )

    const result = await canDeleteUserData('user-1')

    expect(result.canDelete).toBe(true)
  })

  it('proceeds when no audit logs exist (no retention floor)', async () => {
    mockCreateServerClient.mockReturnValue(
      makeMockDb({
        userMeta: { data: { raw_user_meta_data: {} }, error: null },
        firstLog: { data: null, error: null },
      }),
    )

    const result = await canDeleteUserData('user-1')

    expect(result.canDelete).toBe(true)
  })
})

describe('canDeleteUserData — gate 3: active subscription', () => {
  it('blocks when subscription_status === active', async () => {
    mockCreateServerClient.mockReturnValue(
      makeMockDb({
        userMeta: {
          data: { raw_user_meta_data: { subscription_status: 'active' } },
          error: null,
        },
      }),
    )

    const result = await canDeleteUserData('user-1')

    expect(result).toEqual({
      canDelete: false,
      reason: 'Active subscription requires data retention',
    })
  })

  it('allows when subscription_status is canceled/missing', async () => {
    mockCreateServerClient.mockReturnValue(
      makeMockDb({
        userMeta: {
          data: { raw_user_meta_data: { subscription_status: 'canceled' } },
          error: null,
        },
      }),
    )

    const result = await canDeleteUserData('user-1')

    expect(result.canDelete).toBe(true)
  })
})

describe('canDeleteUserData — happy path + failure modes', () => {
  it('allows deletion when no holds (empty metadata, no audit logs)', async () => {
    mockCreateServerClient.mockReturnValue(
      makeMockDb({
        userMeta: { data: { raw_user_meta_data: {} }, error: null },
      }),
    )

    const result = await canDeleteUserData('user-1')

    expect(result).toEqual({ canDelete: true })
  })

  it('fails closed when user metadata fetch errors (Unable to verify)', async () => {
    mockCreateServerClient.mockReturnValue(
      makeMockDb({
        userMeta: { data: null, error: { message: 'auth.users not found' } },
      }),
    )

    const result = await canDeleteUserData('user-1')

    expect(result).toEqual({
      canDelete: false,
      reason: 'Unable to verify legal hold status',
    })
  })

  it('fails closed when createServerClient throws (catch-all)', async () => {
    mockCreateServerClient.mockImplementation(() => {
      throw new Error('D1 binding missing')
    })

    const result = await canDeleteUserData('user-1')

    expect(result).toEqual({
      canDelete: false,
      reason: 'Error verifying legal hold status',
    })
  })
})

describe('canDeleteUserData — gate ordering (legal hold > retention > subscription)', () => {
  it('returns legal hold reason when ALL three gates would trigger', async () => {
    const firstLogCreatedAt = FIXED_NOW_MS - 30 * MS_PER_DAY
    mockCreateServerClient.mockReturnValue(
      makeMockDb({
        userMeta: {
          data: {
            raw_user_meta_data: {
              legalHold: { active: true, until: 9999 },
              subscription_status: 'active',
            },
          },
          error: null,
        },
        firstLog: { data: { created_at: firstLogCreatedAt }, error: null },
      }),
    )

    const result = await canDeleteUserData('user-1')

    expect(result.reason).toBe('Active legal hold')
  })

  it('returns SOC 2 reason when retention + subscription gates trigger (no legal hold)', async () => {
    const firstLogCreatedAt = FIXED_NOW_MS - 30 * MS_PER_DAY
    mockCreateServerClient.mockReturnValue(
      makeMockDb({
        userMeta: {
          data: { raw_user_meta_data: { subscription_status: 'active' } },
          error: null,
        },
        firstLog: { data: { created_at: firstLogCreatedAt }, error: null },
      }),
    )

    const result = await canDeleteUserData('user-1')

    expect(result.reason).toMatch(/SOC 2 retention/)
  })
})
