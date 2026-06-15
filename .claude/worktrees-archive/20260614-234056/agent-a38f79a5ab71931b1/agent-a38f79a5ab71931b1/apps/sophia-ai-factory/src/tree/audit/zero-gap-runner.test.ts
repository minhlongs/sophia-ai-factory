/**
 * Tests for Zero-GAP audit runner (parallel orchestrator over 10 check categories).
 *
 * Pins parallel execution, per-check try/catch with synthetic 'fail' result on
 * thrown errors, 29s timeout fallback, eager-collector convenience wrapper,
 * and that one failing check doesn't abort the rest.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const {
  mockEndpoint,
  mockJourney,
  mockLanding,
  mockTestCov,
  mockCron,
  mockProvider,
  mockSecurity,
  mockI18n,
  mockPerf,
  mockDataInt,
} = vi.hoisted(() => ({
  mockEndpoint: vi.fn(),
  mockJourney: vi.fn(),
  mockLanding: vi.fn(),
  mockTestCov: vi.fn(),
  mockCron: vi.fn(),
  mockProvider: vi.fn(),
  mockSecurity: vi.fn(),
  mockI18n: vi.fn(),
  mockPerf: vi.fn(),
  mockDataInt: vi.fn(),
}))

vi.mock('@/tree/audit/checks/endpoint-contract', () => ({ runEndpointChecks: mockEndpoint }))
vi.mock('@/tree/audit/checks/customer-journey', () => ({ runJourneyChecks: mockJourney }))
vi.mock('@/tree/audit/checks/landing-claim-coverage', () => ({ runLandingClaimChecks: mockLanding }))
vi.mock('@/tree/audit/checks/test-coverage', () => ({ runTestCoverageChecks: mockTestCov }))
vi.mock('@/tree/audit/checks/cron-health', () => ({ runCronHealthChecks: mockCron }))
vi.mock('@/tree/audit/checks/provider-connectivity', () => ({ runProviderChecks: mockProvider }))
vi.mock('@/tree/audit/checks/security-audit', () => ({ runSecurityChecks: mockSecurity }))
vi.mock('@/tree/audit/checks/i18n-coverage', () => ({ runI18nChecks: mockI18n }))
vi.mock('@/tree/audit/checks/performance', () => ({ runPerfChecks: mockPerf }))
vi.mock('@/tree/audit/checks/data-integrity', () => ({ runDataIntegrityChecks: mockDataInt }))

import { runFullAudit, runFullAuditEager } from './zero-gap-runner'
import type { CheckResult, AuditEnv } from './zero-gap-types'

const env = {} as AuditEnv

function passCheck(category: string, id = `${category}-pass`): CheckResult {
  return {
    id,
    category,
    name: 'ok',
    status: 'pass',
    weight: 1,
    score: 1,
    evidence: '',
    durationMs: 10,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  // All 10 mocks return a single pass check by default
  mockEndpoint.mockResolvedValue([passCheck('endpoint-contract')])
  mockJourney.mockResolvedValue([passCheck('customer-journey')])
  mockLanding.mockResolvedValue([passCheck('landing-claim-coverage')])
  mockTestCov.mockResolvedValue([passCheck('test-coverage')])
  mockCron.mockResolvedValue([passCheck('cron-health')])
  mockProvider.mockResolvedValue([passCheck('provider-connectivity')])
  mockSecurity.mockResolvedValue([passCheck('security-audit')])
  mockI18n.mockResolvedValue([passCheck('i18n-coverage')])
  mockPerf.mockResolvedValue([passCheck('performance')])
  mockDataInt.mockResolvedValue([passCheck('data-integrity')])
})

afterEach(() => {
  vi.useRealTimers()
})

describe('runFullAuditEager — happy path', () => {
  it('returns results from all 10 categories', async () => {
    const results = await runFullAuditEager('user-1', env)
    expect(results).toHaveLength(10)
    const categories = results.map((r) => r.category).sort()
    expect(categories).toEqual([
      'cron-health',
      'customer-journey',
      'data-integrity',
      'endpoint-contract',
      'i18n-coverage',
      'landing-claim-coverage',
      'performance',
      'provider-connectivity',
      'security-audit',
      'test-coverage',
    ])
  })

  it('flattens multiple results per category', async () => {
    mockEndpoint.mockResolvedValueOnce([
      passCheck('endpoint-contract', 'ep-1'),
      passCheck('endpoint-contract', 'ep-2'),
      passCheck('endpoint-contract', 'ep-3'),
    ])
    const results = await runFullAuditEager('user-1', env)
    const endpointResults = results.filter((r) => r.category === 'endpoint-contract')
    expect(endpointResults).toHaveLength(3)
    expect(endpointResults.map((r) => r.id)).toEqual(['ep-1', 'ep-2', 'ep-3'])
  })

  it('runs all category checks in parallel (calls each mock exactly once)', async () => {
    await runFullAuditEager('user-1', env)
    expect(mockEndpoint).toHaveBeenCalledTimes(1)
    expect(mockJourney).toHaveBeenCalledTimes(1)
    expect(mockSecurity).toHaveBeenCalledTimes(1)
    expect(mockDataInt).toHaveBeenCalledTimes(1)
  })

  it('passes env to every check function', async () => {
    const customEnv = { foo: 'bar' } as unknown as AuditEnv
    await runFullAuditEager('user-1', customEnv)
    expect(mockEndpoint).toHaveBeenCalledWith(customEnv)
    expect(mockI18n).toHaveBeenCalledWith(customEnv)
  })
})

describe('runFullAuditEager — per-category error isolation', () => {
  it('synthesizes a fail result when a category throws (does not abort other categories)', async () => {
    mockSecurity.mockRejectedValueOnce(new Error('migration table missing'))

    const results = await runFullAuditEager('user-1', env)

    expect(results).toHaveLength(10)
    const secResult = results.find((r) => r.category === 'security-audit')
    expect(secResult).toBeDefined()
    expect(secResult?.status).toBe('fail')
    expect(secResult?.name).toBe('security-audit (error)')
    expect(secResult?.evidence).toContain('migration table missing')
    expect(secResult?.score).toBe(0)
    expect(secResult?.weight).toBe(5)
    expect(secResult?.fix).toMatch(/Fix the check implementation/)
  })

  it('handles non-Error throws with "unknown" fallback message', async () => {
    mockProvider.mockRejectedValueOnce('string-error')

    const results = await runFullAuditEager('user-1', env)
    const provResult = results.find((r) => r.category === 'provider-connectivity')
    expect(provResult?.evidence).toContain('unknown')
  })

  it('still produces 10 categories when multiple throw simultaneously', async () => {
    mockSecurity.mockRejectedValueOnce(new Error('sec'))
    mockProvider.mockRejectedValueOnce(new Error('prov'))
    mockPerf.mockRejectedValueOnce(new Error('perf'))

    const results = await runFullAuditEager('user-1', env)

    expect(results).toHaveLength(10)
    expect(results.filter((r) => r.status === 'fail')).toHaveLength(3)
    expect(results.filter((r) => r.status === 'pass')).toHaveLength(7)
  })
})

describe('runFullAuditEager — 29s timeout', () => {
  it('produces a timeout fail result when a check exceeds 29s', async () => {
    vi.useFakeTimers()
    // Never-resolving promise → only timeout path produces a result
    mockSecurity.mockImplementationOnce(() => new Promise(() => {}))

    const promise = runFullAuditEager('user-1', env)
    // Advance time past 29s
    await vi.advanceTimersByTimeAsync(29_000)
    const results = await promise

    const secResult = results.find((r) => r.category === 'security-audit')
    expect(secResult?.status).toBe('fail')
    expect(secResult?.name).toBe('security-audit (timed out)')
    expect(secResult?.evidence).toContain('29s')
    expect(secResult?.durationMs).toBe(29_000)
  })
})

describe('runFullAudit (async iterable)', () => {
  it('yields one result per check across all categories', async () => {
    const collected: CheckResult[] = []
    for await (const r of runFullAudit('user-1', env)) {
      collected.push(r)
    }
    expect(collected).toHaveLength(10)
  })

  it('yields multiple results when a category returns multiple checks', async () => {
    mockEndpoint.mockResolvedValueOnce([
      passCheck('endpoint-contract', 'ep-a'),
      passCheck('endpoint-contract', 'ep-b'),
    ])
    const collected: CheckResult[] = []
    for await (const r of runFullAudit('user-1', env)) {
      collected.push(r)
    }
    expect(collected.filter((r) => r.category === 'endpoint-contract')).toHaveLength(2)
  })
})
