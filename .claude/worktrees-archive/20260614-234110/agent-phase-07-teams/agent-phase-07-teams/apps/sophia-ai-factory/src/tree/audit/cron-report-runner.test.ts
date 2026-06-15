/**
 * Tests for cron report runner (scheduled-report orchestrator).
 *
 * Pins the per-report pipeline: fetch → generate → deliver → store → schedule-next,
 * delivery failure → throw, and the batch runner's per-report try/catch that
 * collects failures into RunResult.details without aborting the whole batch.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

const {
  mockGetDueReports,
  mockUpdateNextRunAt,
  mockCalculateNextRunAt,
} = vi.hoisted(() => ({
  mockGetDueReports: vi.fn(),
  mockUpdateNextRunAt: vi.fn(),
  mockCalculateNextRunAt: vi.fn(),
}))
vi.mock('@/tree/audit/report-scheduler', () => ({
  getDueReports: mockGetDueReports,
  updateNextRunAt: mockUpdateNextRunAt,
  calculateNextRunAt: mockCalculateNextRunAt,
}))

const { mockGenerateReport } = vi.hoisted(() => ({ mockGenerateReport: vi.fn() }))
vi.mock('@/tree/audit/pdf-report-generator', () => ({
  generateReport: mockGenerateReport,
}))

const { mockDeliverReport, mockStoreReport } = vi.hoisted(() => ({
  mockDeliverReport: vi.fn(),
  mockStoreReport: vi.fn(),
}))
vi.mock('@/tree/audit/report-delivery', () => ({
  deliverReport: mockDeliverReport,
  storeReport: mockStoreReport,
}))

const { mockFetchComplianceData } = vi.hoisted(() => ({ mockFetchComplianceData: vi.fn() }))
vi.mock('@/tree/audit/cron-report-runner-data-fetcher', () => ({
  fetchComplianceData: mockFetchComplianceData,
}))

import { generateAndDeliverReport, runScheduledReports } from './cron-report-runner'
import type { ScheduledReport } from './report-scheduler'
import { logger } from '@/seed/utils/logger-utility'

function makeReport(over: Partial<ScheduledReport> = {}): ScheduledReport {
  return {
    id: 'rpt-1',
    type: 'compliance',
    frequency: 'daily',
    format: 'pdf',
    recipients: ['admin@example.com'],
    filters: {
      startDate: 1_700_000_000,
      endDate: 1_700_086_400,
      licenseNonce: 'nonce-1',
    },
    nextRunAt: 1_700_000_000,
    ...over,
  } as ScheduledReport
}

beforeEach(() => {
  vi.clearAllMocks()
  mockFetchComplianceData.mockResolvedValue({ reportId: 'data-rep-1' })
  mockGenerateReport.mockReturnValue('REPORT-BYTES')
  mockDeliverReport.mockResolvedValue({ delivered: true })
  mockStoreReport.mockResolvedValue('https://storage.example/r.pdf')
  mockCalculateNextRunAt.mockReturnValue(1_700_086_400_000)
  mockUpdateNextRunAt.mockResolvedValue(undefined)
})

describe('generateAndDeliverReport — happy path', () => {
  it('runs fetch → generate → deliver → store → schedule-next in order', async () => {
    const report = makeReport()
    await generateAndDeliverReport(report)

    expect(mockFetchComplianceData).toHaveBeenCalledWith({
      startDate: 1_700_000_000,
      endDate: 1_700_086_400,
      licenseNonce: 'nonce-1',
    })
    expect(mockGenerateReport).toHaveBeenCalledWith({ reportId: 'data-rep-1' }, 'pdf')
    expect(mockDeliverReport).toHaveBeenCalledWith(report, expect.any(Buffer))
    expect(mockStoreReport).toHaveBeenCalledWith('data-rep-1', 'REPORT-BYTES', 'pdf')
    expect(mockCalculateNextRunAt).toHaveBeenCalledWith('daily')
    expect(mockUpdateNextRunAt).toHaveBeenCalledWith('rpt-1', 1_700_086_400) // /1000 floor
  })

  it('converts string report content to Buffer for delivery', async () => {
    await generateAndDeliverReport(makeReport())
    const bufferArg = mockDeliverReport.mock.calls[0][1]
    expect(Buffer.isBuffer(bufferArg)).toBe(true)
    expect(bufferArg.toString()).toBe('REPORT-BYTES')
  })
})

describe('generateAndDeliverReport — failure modes', () => {
  it('throws + logs error when delivery returns delivered=false', async () => {
    mockDeliverReport.mockResolvedValueOnce({ delivered: false, errors: ['SMTP refused', 'R2 timeout'] })
    await expect(generateAndDeliverReport(makeReport())).rejects.toThrow(
      /Delivery failed: SMTP refused, R2 timeout/,
    )
    expect(mockStoreReport).not.toHaveBeenCalled()
    expect(mockUpdateNextRunAt).not.toHaveBeenCalled()
  })

  it('propagates error from fetchComplianceData (no later steps)', async () => {
    mockFetchComplianceData.mockRejectedValueOnce(new Error('D1 down'))
    await expect(generateAndDeliverReport(makeReport())).rejects.toThrow(/D1 down/)
    expect(mockGenerateReport).not.toHaveBeenCalled()
    expect(logger.error).toHaveBeenCalled()
  })

  it('propagates error from storeReport (does NOT update nextRunAt)', async () => {
    mockStoreReport.mockRejectedValueOnce(new Error('R2 write failed'))
    await expect(generateAndDeliverReport(makeReport())).rejects.toThrow(/R2 write failed/)
    expect(mockUpdateNextRunAt).not.toHaveBeenCalled()
  })
})

describe('runScheduledReports — batch orchestration', () => {
  it('returns zero-result + early-exit when no reports due', async () => {
    mockGetDueReports.mockResolvedValueOnce([])

    const result = await runScheduledReports()

    expect(result).toEqual({ executed: 0, errors: 0, details: [] })
    expect(mockFetchComplianceData).not.toHaveBeenCalled()
  })

  it('processes each due report and counts executed=N when all succeed', async () => {
    mockGetDueReports.mockResolvedValueOnce([
      makeReport({ id: 'a' }),
      makeReport({ id: 'b' }),
      makeReport({ id: 'c' }),
    ])

    const result = await runScheduledReports()

    expect(result.executed).toBe(3)
    expect(result.errors).toBe(0)
    expect(result.details).toHaveLength(3)
    expect(result.details.map((d) => d.success)).toEqual([true, true, true])
    expect(result.details[0].recipients).toEqual(['admin@example.com'])
  })

  it('continues processing after a single report fails (collects errors in details)', async () => {
    mockGetDueReports.mockResolvedValueOnce([
      makeReport({ id: 'a' }),
      makeReport({ id: 'b' }),
      makeReport({ id: 'c' }),
    ])
    // b fails delivery
    mockDeliverReport
      .mockResolvedValueOnce({ delivered: true })
      .mockResolvedValueOnce({ delivered: false, errors: ['SMTP fail'] })
      .mockResolvedValueOnce({ delivered: true })

    const result = await runScheduledReports()

    expect(result.executed).toBe(2)
    expect(result.errors).toBe(1)
    expect(result.details).toHaveLength(3)
    expect(result.details[0].success).toBe(true)
    expect(result.details[1].success).toBe(false)
    expect(result.details[1].error).toMatch(/Delivery failed/)
    expect(result.details[2].success).toBe(true)
  })

  it('catches getDueReports throw and returns errors=1 with partial details', async () => {
    mockGetDueReports.mockRejectedValueOnce(new Error('scheduler table missing'))

    const result = await runScheduledReports()

    expect(result.executed).toBe(0)
    expect(result.errors).toBe(1)
    expect(result.details).toEqual([])
    expect(logger.error).toHaveBeenCalled()
  })

  it('preserves report type+format in detail rows', async () => {
    mockGetDueReports.mockResolvedValueOnce([
      makeReport({ id: 'x', type: 'usage', format: 'csv' }),
    ])

    const result = await runScheduledReports()

    expect(result.details[0]).toMatchObject({
      reportId: 'x',
      type: 'usage',
      format: 'csv',
      success: true,
    })
  })
})
