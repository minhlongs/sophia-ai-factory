/**
 * Tests for cron-report-runner-data-fetcher (compliance data aggregator).
 *
 * Pins multi-table query orchestration (audit count + licenses + usage events
 * + validation logs), default 30-day window, model breakdown rollup,
 * license validation/usage counter joins, and period boundary semantics.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const { mockCreateServerClient } = vi.hoisted(() => ({ mockCreateServerClient: vi.fn() }))
vi.mock('@/seed/db/client', () => ({
  getD1: vi.fn(),
  createServerClient: mockCreateServerClient,
}))

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

import { fetchComplianceData } from './cron-report-runner-data-fetcher'
import { logger } from '@/seed/utils/logger-utility'

interface MockResponses {
  /** totalLogs count from head:true select with optional licenseNonce filter */
  auditLogsCount?: number
  licenses?: Array<{ nonce: string; tier: string; created_at: number; last_used_at: number | null }>
  usageEvents?: Array<{
    license_nonce: string
    model_name: string | null
    token_count: number | null
    tokens_input: number | null
    tokens_output: number | null
  }>
  validationLogs?: Array<{ license_nonce: string }>
  /** Throw when first table queried (force catch path) */
  throwOnFirstQuery?: boolean
}

interface CapturedCall {
  table: string
  filters: { startDate?: number; endDate?: number; licenseNonce?: string }
}

function setupMock(responses: MockResponses) {
  const calls: CapturedCall[] = []
  let queryNum = 0

  mockCreateServerClient.mockReturnValue({
    from: (table: string) => {
      const current: CapturedCall = { table, filters: {} }
      calls.push(current)
      queryNum++
      const currentQueryIdx = queryNum

      // Build a thenable builder
      const builder: Record<string, unknown> = {}
      builder.select = vi.fn(() => builder)
      builder.eq = vi.fn((col: string, val: unknown) => {
        if (col === 'license_nonce') current.filters.licenseNonce = String(val)
        return builder
      })
      builder.gte = vi.fn((col: string, val: unknown) => {
        if (col === 'created_at') current.filters.startDate = Number(val)
        return builder
      })
      builder.lte = vi.fn((col: string, val: unknown) => {
        if (col === 'created_at') current.filters.endDate = Number(val)
        return builder
      })

      // Resolution differs per table + query order
      builder.then = (resolve: (val: Record<string, unknown>) => void) => {
        if (responses.throwOnFirstQuery && currentQueryIdx === 1) {
          throw new Error('D1 query failed')
        }
        if (table === 'raas_audit_logs' && currentQueryIdx === 1) {
          // First call — count query (audit log total)
          resolve({ count: responses.auditLogsCount ?? 0, data: null, error: null })
        } else if (table === 'raas_licenses') {
          resolve({ data: responses.licenses ?? [], error: null })
        } else if (table === 'raas_usage_events') {
          resolve({ data: responses.usageEvents ?? [], error: null })
        } else if (table === 'raas_audit_logs') {
          // Second call (validation query — action=VALIDATE)
          resolve({ data: responses.validationLogs ?? [], error: null })
        } else {
          resolve({ data: [], error: null })
        }
      }
      return builder
    },
  })
  return { calls }
}

const FIXED_NOW = new Date('2026-05-11T12:00:00Z')
const FIXED_NOW_SEC = Math.floor(FIXED_NOW.getTime() / 1000)

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers()
  vi.setSystemTime(FIXED_NOW)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('fetchComplianceData — default time window', () => {
  it('defaults startDate to 30 days before now when omitted', async () => {
    const { calls } = setupMock({})
    await fetchComplianceData({})
    const auditCall = calls.find((c) => c.table === 'raas_audit_logs')
    expect(auditCall?.filters.startDate).toBe(FIXED_NOW_SEC - 30 * 86400)
    expect(auditCall?.filters.endDate).toBe(FIXED_NOW_SEC)
  })

  it('honors explicit startDate / endDate filters', async () => {
    const { calls } = setupMock({})
    await fetchComplianceData({ startDate: 1_000, endDate: 2_000 })
    const auditCall = calls.find((c) => c.table === 'raas_audit_logs')
    expect(auditCall?.filters.startDate).toBe(1_000)
    expect(auditCall?.filters.endDate).toBe(2_000)
  })

  it('passes licenseNonce filter to audit logs count query when provided', async () => {
    const { calls } = setupMock({})
    await fetchComplianceData({ licenseNonce: 'nonce-1' })
    const auditCall = calls.find((c) => c.table === 'raas_audit_logs')
    expect(auditCall?.filters.licenseNonce).toBe('nonce-1')
  })
})

describe('fetchComplianceData — output shape', () => {
  it('returns reportId UUID + generatedBy=system-cron', async () => {
    setupMock({})
    const data = await fetchComplianceData({})
    expect(data.reportId).toMatch(/^[0-9a-f-]{36}$/i)
    expect(data.generatedBy).toBe('system-cron')
  })

  it('includes period as Date objects converted from unix seconds', async () => {
    setupMock({})
    const data = await fetchComplianceData({ startDate: 1_700_000_000, endDate: 1_700_086_400 })
    expect(data.period.start).toEqual(new Date(1_700_000_000 * 1000))
    expect(data.period.end).toEqual(new Date(1_700_086_400 * 1000))
  })

  it('summary.totalLogs reflects count from audit query', async () => {
    setupMock({ auditLogsCount: 42 })
    const data = await fetchComplianceData({})
    expect(data.summary.totalLogs).toBe(42)
  })

  it('summary.hashChainValid defaults to true (writer not yet wired)', async () => {
    setupMock({})
    const data = await fetchComplianceData({})
    expect(data.summary.hashChainValid).toBe(true)
  })

  it('hashChainVerification placeholder values when chain not stored', async () => {
    setupMock({ auditLogsCount: 100 })
    const data = await fetchComplianceData({})
    expect(data.hashChainVerification).toEqual({
      firstHash: 'N/A',
      lastHash: 'N/A',
      totalLogs: 100,
      verified: true,
    })
  })
})

describe('fetchComplianceData — model breakdown rollup', () => {
  it('aggregates token totals per model_name', async () => {
    setupMock({
      usageEvents: [
        { license_nonce: 'l1', model_name: 'gpt-4o', token_count: 100, tokens_input: 60, tokens_output: 40 },
        { license_nonce: 'l1', model_name: 'gpt-4o', token_count: 200, tokens_input: 120, tokens_output: 80 },
        { license_nonce: 'l2', model_name: 'claude-3', token_count: 50, tokens_input: 30, tokens_output: 20 },
      ],
    })
    const data = await fetchComplianceData({})
    const gpt = data.modelBreakdown.find((m) => m.modelName === 'gpt-4o')
    const claude = data.modelBreakdown.find((m) => m.modelName === 'claude-3')
    expect(gpt).toEqual({
      modelName: 'gpt-4o',
      invocations: 2,
      tokensProcessed: 300,
      tokensInput: 180,
      tokensOutput: 120,
    })
    expect(claude).toEqual({
      modelName: 'claude-3',
      invocations: 1,
      tokensProcessed: 50,
      tokensInput: 30,
      tokensOutput: 20,
    })
  })

  it('groups null model_name under "unknown"', async () => {
    setupMock({
      usageEvents: [
        { license_nonce: 'l1', model_name: null, token_count: 10, tokens_input: 5, tokens_output: 5 },
      ],
    })
    const data = await fetchComplianceData({})
    expect(data.modelBreakdown[0].modelName).toBe('unknown')
  })

  it('coerces null token fields to 0 in aggregation', async () => {
    setupMock({
      usageEvents: [
        { license_nonce: 'l1', model_name: 'm1', token_count: null, tokens_input: null, tokens_output: null },
      ],
    })
    const data = await fetchComplianceData({})
    expect(data.modelBreakdown[0]).toMatchObject({
      tokensProcessed: 0,
      tokensInput: 0,
      tokensOutput: 0,
    })
  })

  it('returns empty modelBreakdown when no usage events', async () => {
    setupMock({})
    const data = await fetchComplianceData({})
    expect(data.modelBreakdown).toEqual([])
  })
})

describe('fetchComplianceData — license rollup', () => {
  it('joins validation count + usage credits onto each license', async () => {
    setupMock({
      licenses: [
        { nonce: 'l1', tier: 'PREMIUM', created_at: 1_700_000_000, last_used_at: 1_700_086_400 },
        { nonce: 'l2', tier: 'BASIC', created_at: 1_700_000_000, last_used_at: null },
      ],
      validationLogs: [
        { license_nonce: 'l1' },
        { license_nonce: 'l1' },
        { license_nonce: 'l1' },
        { license_nonce: 'l2' },
      ],
      usageEvents: [
        { license_nonce: 'l1', model_name: 'm', token_count: 100, tokens_input: 60, tokens_output: 40 },
        { license_nonce: 'l1', model_name: 'm', token_count: 50, tokens_input: 30, tokens_output: 20 },
      ],
    })
    const data = await fetchComplianceData({})
    expect(data.licenses).toHaveLength(2)
    const l1 = data.licenses.find((l) => l.nonce === 'l1')
    expect(l1).toMatchObject({
      tier: 'PREMIUM',
      validationCount: 3,
      usageCredits: 150,
      createdAt: new Date(1_700_000_000 * 1000).toISOString(),
      lastUsedAt: new Date(1_700_086_400 * 1000).toISOString(),
    })
  })

  it('returns undefined lastUsedAt when license has null last_used_at', async () => {
    setupMock({
      licenses: [{ nonce: 'l1', tier: 'BASIC', created_at: 1_700_000_000, last_used_at: null }],
    })
    const data = await fetchComplianceData({})
    expect(data.licenses[0].lastUsedAt).toBeUndefined()
  })

  it('defaults validationCount and usageCredits to 0 when no joins', async () => {
    setupMock({
      licenses: [{ nonce: 'lonely', tier: 'BASIC', created_at: 1_700_000_000, last_used_at: null }],
    })
    const data = await fetchComplianceData({})
    expect(data.licenses[0]).toMatchObject({ validationCount: 0, usageCredits: 0 })
  })

  it('summary.totalLicenses + summary.totalUsage reflect array lengths', async () => {
    setupMock({
      licenses: [
        { nonce: 'a', tier: 'BASIC', created_at: 1_700_000_000, last_used_at: null },
        { nonce: 'b', tier: 'BASIC', created_at: 1_700_000_000, last_used_at: null },
      ],
      usageEvents: [
        { license_nonce: 'a', model_name: 'm', token_count: 1, tokens_input: 1, tokens_output: 0 },
        { license_nonce: 'b', model_name: 'm', token_count: 1, tokens_input: 1, tokens_output: 0 },
        { license_nonce: 'a', model_name: 'm', token_count: 1, tokens_input: 1, tokens_output: 0 },
      ],
    })
    const data = await fetchComplianceData({})
    expect(data.summary.totalLicenses).toBe(2)
    expect(data.summary.totalUsage).toBe(3)
  })
})

describe('fetchComplianceData — error handling', () => {
  it('logs + rethrows when underlying query throws', async () => {
    setupMock({ throwOnFirstQuery: true })
    await expect(fetchComplianceData({})).rejects.toThrow(/D1 query failed/)
    expect(logger.error).toHaveBeenCalled()
  })
})
