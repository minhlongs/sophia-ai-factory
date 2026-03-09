/**
 * Report Scheduler Tests
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import {
  calculateNextRunAt,
  validateFilters,
  type ReportFilters,
  type ScheduleReportInput
} from './report-scheduler'

// Mock Supabase admin client
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(),
}))

// Mock logger
vi.mock('@/lib/utils/logger-utility', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}))

// Import after mocks
import { scheduleReport, getScheduledReports, cancelScheduledReport, getDueReports, updateNextRunAt } from './report-scheduler'
import { createAdminClient } from '@/lib/supabase/admin'

describe('calculateNextRunAt', () => {
  const baseTime = new Date('2026-03-08T12:00:00Z').getTime()

  it('calculates next day for daily frequency', () => {
    const next = calculateNextRunAt('daily', baseTime)
    expect(next).toBe(baseTime + 24 * 60 * 60 * 1000)
  })

  it('calculates next week for weekly frequency', () => {
    const next = calculateNextRunAt('weekly', baseTime)
    expect(next).toBe(baseTime + 7 * 24 * 60 * 60 * 1000)
  })

  it('calculates next month for monthly frequency', () => {
    const next = calculateNextRunAt('monthly', baseTime)
    const expected = new Date('2026-04-08T12:00:00Z').getTime()
    expect(next).toBe(expected)
  })

  it('handles month-end edge cases for monthly frequency', () => {
    // Jan 31 -> Feb 28 (non-leap year)
    const jan31 = new Date('2026-01-31T12:00:00Z').getTime()
    const next = calculateNextRunAt('monthly', jan31)
    const expected = new Date('2026-02-28T12:00:00Z').getTime()
    expect(next).toBe(expected)
  })

  it('calculates next quarter for quarterly frequency', () => {
    const next = calculateNextRunAt('quarterly', baseTime)
    const expected = new Date('2026-06-08T12:00:00Z').getTime()
    expect(next).toBe(expected)
  })

  it('throws error for invalid frequency', () => {
    expect(() => calculateNextRunAt('invalid' as any, baseTime)).toThrow('Invalid frequency')
  })
})

describe('validateFilters', () => {
  it('validates empty filters', () => {
    expect(() => validateFilters({})).not.toThrow()
  })

  it('validates correct date range', () => {
    expect(() =>
      validateFilters({
        startDate: 1000,
        endDate: 2000
      })
    ).not.toThrow()
  })

  it('throws when startDate > endDate', () => {
    expect(() =>
      validateFilters({
        startDate: 2000,
        endDate: 1000
      })
    ).toThrow('startDate must be before endDate')
  })

  it('throws when modelNames is empty array', () => {
    expect(() =>
      validateFilters({
        modelNames: []
      })
    ).toThrow('modelNames array cannot be empty')
  })

  it('throws when tiers is empty array', () => {
    expect(() =>
      validateFilters({
        tiers: []
      })
    ).toThrow('tiers array cannot be empty')
  })

  it('validates non-empty modelNames', () => {
    expect(() =>
      validateFilters({
        modelNames: ['gpt-4', 'claude-3']
      })
    ).not.toThrow()
  })
})

describe('scheduleReport', () => {
  let mockSupabase: any
  let mockChain: any
  let mockSingle: any

  beforeEach(() => {
    vi.clearAllMocks()

    mockSingle = vi.fn()
    mockChain = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: mockSingle,
      delete: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis()
    }
    mockSupabase = {
      from: vi.fn().mockReturnValue(mockChain)
    }
    vi.mocked(createAdminClient).mockReturnValue(mockSupabase)
  })

  it('schedules a report successfully', async () => {
    const mockSingleResult = {
      data: {
        id: 'test-uuid',
        report_type: 'compliance',
        format: 'pdf',
        frequency: 'weekly',
        recipients: ['admin@example.com'],
        filters: { includePII: false },
        next_run_at: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60,
        created_at: Math.floor(Date.now() / 1000),
        created_by: 'admin'
      },
      error: null as any
    }

    mockSingle.mockResolvedValue(mockSingleResult)

    const report = await scheduleReport({
      type: 'compliance',
      format: 'pdf',
      frequency: 'weekly',
      recipients: ['admin@example.com'],
      filters: { includePII: false },
      createdBy: 'admin'
    } as ScheduleReportInput)

    expect(report.id).toBe('test-uuid')
    expect(report.type).toBe('compliance')
    expect(report.frequency).toBe('weekly')
  })

  it('throws error when database insert fails', async () => {
    const mockSingleResult = {
      data: null,
      error: new Error('Database error') as any
    }

    mockSingle.mockResolvedValue(mockSingleResult)

    await expect(
      scheduleReport({
        type: 'compliance',
        format: 'pdf',
        frequency: 'weekly',
        recipients: ['admin@example.com'],
        filters: {},
        createdBy: 'admin'
      } as ScheduleReportInput)
    ).rejects.toThrow('Database error')
  })
})

describe('getScheduledReports', () => {
  let mockSupabase: any
  let mockChain: any

  beforeEach(() => {
    vi.clearAllMocks()
    mockChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
      single: vi.fn().mockReturnThis()
    }
    mockSupabase = {
      from: vi.fn().mockReturnValue(mockChain)
    }
    vi.mocked(createAdminClient).mockReturnValue(mockSupabase)
  })

  it('returns empty array when no reports exist', async () => {
    const mockResult = {
      data: [],
      error: null as any
    }
    mockChain.order.mockResolvedValue(mockResult)

    const reports = await getScheduledReports('admin')
    expect(reports).toEqual([])
  })

  it('returns scheduled reports for admin', async () => {
    const mockData = [
      {
        id: 'report-1',
        report_type: 'compliance',
        format: 'pdf',
        frequency: 'weekly',
        recipients: ['admin@example.com'],
        filters: { includePII: false },
        next_run_at: Math.floor(Date.now() / 1000),
        created_at: Math.floor(Date.now() / 1000),
        created_by: 'admin'
      }
    ]

    const mockResult = {
      data: mockData,
      error: null as any
    }
    mockChain.order.mockResolvedValue(mockResult)

    const reports = await getScheduledReports('admin')
    expect(reports).toHaveLength(1)
    expect(reports[0].id).toBe('report-1')
  })
})

describe('cancelScheduledReport', () => {
  let mockSupabase: any
  let mockChain: any

  beforeEach(() => {
    vi.clearAllMocks()
    mockChain = {
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null })
    }
    mockSupabase = {
      from: vi.fn().mockReturnValue(mockChain)
    }
    vi.mocked(createAdminClient).mockReturnValue(mockSupabase)
  })

  it('cancels a report successfully', async () => {
    const mockResult = {
      data: null,
      error: null as any
    }
    mockChain.single.mockResolvedValue(mockResult)

    await expect(cancelScheduledReport('report-uuid')).resolves.not.toThrow()
  })
})

describe('updateNextRunAt', () => {
  let mockSupabase: any
  let mockChain: any

  beforeEach(() => {
    vi.clearAllMocks()
    mockChain = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null })
    }
    mockSupabase = {
      from: vi.fn().mockReturnValue(mockChain)
    }
    vi.mocked(createAdminClient).mockReturnValue(mockSupabase)
  })

  it('updates next run timestamp', async () => {
    const mockResult = {
      data: null,
      error: null as any
    }
    mockChain.single.mockResolvedValue(mockResult)

    await expect(updateNextRunAt('report-uuid', 1234567890)).resolves.not.toThrow()
  })
})

describe('getDueReports', () => {
  let mockSupabase: any
  let mockSelect: any
  let mockLte: any

  beforeEach(() => {
    vi.clearAllMocks()
    mockLte = vi.fn().mockResolvedValue({ data: [], error: null })
    mockSelect = {
      select: vi.fn().mockReturnThis(),
      lte: mockLte,
    }
    mockSupabase = {
      from: vi.fn().mockReturnValue(mockSelect)
    }
    vi.mocked(createAdminClient).mockReturnValue(mockSupabase)
  })

  it('returns due reports', async () => {
    const mockData = [
      {
        id: 'report-1',
        report_type: 'compliance',
        format: 'pdf',
        frequency: 'weekly',
        recipients: ['admin@example.com'],
        filters: { includePII: false },
        next_run_at: Math.floor(Date.now() / 1000) - 1000, // Past due
        created_at: Math.floor(Date.now() / 1000),
        created_by: 'admin'
      }
    ]

    mockLte.mockResolvedValue({ data: mockData, error: null })

    const reports = await getDueReports()
    expect(reports).toHaveLength(1)
    expect(reports[0].id).toBe('report-1')
  })

  it('returns empty array when no reports are due', async () => {
    mockLte.mockResolvedValue({ data: [], error: null })

    const reports = await getDueReports()
    expect(reports).toEqual([])
  })
})
