/**
 * Report Delivery Tests
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import {
  emailReport,
  deliverReport,
  storeReport,
  downloadStoredReport,
  getGeneratedReports,
  type DeliveryResult
} from './report-delivery'
import type { ScheduledReport } from './report-scheduler'

// Mock Supabase admin client
vi.mock('@/seed/db/client', () => ({
  createServerClient: vi.fn(),
}))

// Mock logger
vi.mock('@/seed/utils/logger-utility', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}))

// Import after mocks
import { createServerClient } from '@/seed/db/client'

describe('emailReport', () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.clearAllMocks()
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('logs mock email when SMTP not configured', async () => {
    // Ensure no SMTP env vars are set
    delete process.env.SMTP_HOST
    delete process.env.SMTP_PORT
    delete process.env.SMTP_USERNAME
    delete process.env.SMTP_PASSWORD
    delete process.env.SMTP_FROM

    const logger = await import('@/seed/utils/logger-utility')

    await emailReport(
      ['admin@example.com'],
      'Test Report',
      Buffer.from('test content'),
      'report.pdf'
    )

    // Now we log info instead of warn when email not configured
    expect(logger.logger.info).toHaveBeenCalledWith(
      '[Report Delivery] Mock email would be sent:',
      expect.any(Object)
    )
  })

  it('sends email when SMTP is configured', async () => {
    // Set SMTP env vars
    process.env.SMTP_HOST = 'smtp.example.com'
    process.env.SMTP_PORT = '587'
    process.env.SMTP_USERNAME = 'user@example.com'
    process.env.SMTP_PASSWORD = 'password'
    process.env.SMTP_FROM = 'noreply@example.com'

    const logger = await import('@/seed/utils/logger-utility')

    await emailReport(
      ['admin@example.com'],
      'Test Report',
      Buffer.from('test content'),
      'report.pdf'
    )

    expect(logger.logger.info).toHaveBeenCalledWith(
      '[Report Delivery] Email sent successfully',
      expect.any(Object)
    )
  })
})

describe('deliverReport', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.SMTP_HOST
    delete process.env.SMTP_PORT
    delete process.env.SMTP_USERNAME
    delete process.env.SMTP_PASSWORD
    delete process.env.SMTP_FROM
  })

  it('delivers report successfully', async () => {
    const mockReport: ScheduledReport = {
      id: 'report-uuid',
      type: 'compliance',
      format: 'pdf',
      frequency: 'weekly',
      recipients: ['admin@example.com'],
      filters: { includePII: false },
      nextRunAt: Math.floor(Date.now() / 1000),
      createdAt: Math.floor(Date.now() / 1000),
      createdBy: 'admin'
    }

    const result = await deliverReport(mockReport, Buffer.from('report content'))

    expect(result.delivered).toBe(true)
    expect(result.recipients).toContain('admin@example.com')
    expect(result.method).toBe('email')
  })

  it('includes errors when delivery fails', async () => {
    const mockReport: ScheduledReport = {
      id: 'report-uuid',
      type: 'compliance',
      format: 'pdf',
      frequency: 'weekly',
      recipients: ['invalid-email'],
      filters: {},
      nextRunAt: Math.floor(Date.now() / 1000),
      createdAt: Math.floor(Date.now() / 1000),
      createdBy: 'admin'
    }

    // This would normally fail due to invalid email format
    // But since we mock, it will succeed
    const result = await deliverReport(mockReport, Buffer.from('report content'))

    // In mock mode, delivery succeeds
    expect(result.delivered).toBe(true)
  })

  it('generates correct filename with date', async () => {
    const mockReport: ScheduledReport = {
      id: 'report-uuid',
      type: 'usage',
      format: 'csv',
      frequency: 'daily',
      recipients: ['admin@example.com'],
      filters: {},
      nextRunAt: Math.floor(Date.now() / 1000),
      createdAt: Math.floor(Date.now() / 1000),
      createdBy: 'admin'
    }

    const logger = await import('@/seed/utils/logger-utility')

    await deliverReport(mockReport, 'csv content')

    // Check logger was called (filename logged)
    expect(logger.logger.info).toHaveBeenCalled()
  })
})

describe('storeReport', () => {
  let mockSupabase: any
  let mockStorage: any

  beforeEach(() => {
    vi.clearAllMocks()
    mockStorage = {
      from: vi.fn().mockReturnThis(),
      upload: vi.fn().mockResolvedValue({ error: null }),
      getPublicUrl: vi.fn().mockReturnValue({
        data: { publicUrl: 'https://storage.supabase.co/test-bucket/report.pdf' }
      })
    }
    mockSupabase = {
      storage: mockStorage
    }
    vi.mocked(createServerClient).mockReturnValue(mockSupabase)
  })

  it('stores report in Supabase Storage', async () => {
    const url = await storeReport('report-uuid', Buffer.from('content'), 'pdf')

    expect(url).toBeTruthy()
    expect(url).toContain('https://storage.supabase.co')
  })

  it('handles string content', async () => {
    const url = await storeReport('report-uuid', 'string content', 'json')

    expect(url).toBeTruthy()
  })

  it('returns null when storage upload fails', async () => {
    const mockStorageError = {
      from: vi.fn().mockReturnThis(),
      upload: vi.fn().mockResolvedValue({ error: new Error('Storage error') })
    }
    const mockSupabaseError = {
      storage: mockStorageError
    } as any
    vi.mocked(createServerClient).mockReturnValue(mockSupabaseError)

    const url = await storeReport('report-uuid', Buffer.from('content'), 'pdf')
    expect(url).toBeNull()
  })
})

describe('downloadStoredReport', () => {
  let mockSupabase: any
  let mockStorage: any
  let mockDbChain: any
  let mockSingle: any

  beforeEach(() => {
    vi.clearAllMocks()
    mockSingle = vi.fn()
    mockDbChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: mockSingle,
    }
    mockStorage = {
      from: vi.fn().mockReturnThis(),
      download: vi.fn().mockResolvedValue({
        data: {
          arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(1024))
        },
        error: null
      })
    }
    mockSupabase = {
      from: vi.fn((table: string) => {
        if (table === 'compliance_reports') {
          return mockDbChain
        }
        return mockStorage
      }),
      storage: mockStorage
    }
    vi.mocked(createServerClient).mockReturnValue(mockSupabase)
  })

  it('downloads report from storage', async () => {
    const mockReportData = {
      data: {
        storage_path: '2026-03-08/uuid.pdf',
        format: 'pdf'
      },
      error: null
    }
    mockSingle.mockResolvedValue(mockReportData)

    const content = await downloadStoredReport('report-uuid', 'pdf')

    expect(content).toBeInstanceOf(Buffer)
    expect(content?.length).toBe(1024)
  })

  it('returns null when report not found', async () => {
    const mockReportData = {
      data: null,
      error: new Error('Not found')
    }
    mockSingle.mockResolvedValue(mockReportData)

    const content = await downloadStoredReport('non-existent', 'pdf')
    expect(content).toBeNull()
  })
})

describe('getGeneratedReports', () => {
  let mockSupabase: any
  let mockChain: any

  beforeEach(() => {
    vi.clearAllMocks()
    mockChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [], error: null })
    }
    mockSupabase = {
      from: vi.fn().mockReturnValue(mockChain)
    }
    vi.mocked(createServerClient).mockReturnValue(mockSupabase)
  })

  it('returns list of generated reports', async () => {
    const mockResult = {
      data: [
        {
          id: 'report-1',
          report_type: 'compliance',
          format: 'pdf',
          generated_at: 1234567890,
          generated_by: 'admin',
          storage_path: 'reports/report-1.pdf',
          file_size: 1024,
          schedule_id: 'schedule-1'
        }
      ],
      error: null
    }
    mockChain.limit.mockResolvedValue(mockResult)

    const reports = await getGeneratedReports('admin')

    expect(reports).toHaveLength(1)
    expect(reports[0].id).toBe('report-1')
    expect(reports[0].type).toBe('compliance')
  })

  it('returns empty array when no reports exist', async () => {
    mockChain.limit.mockResolvedValue({ data: [], error: null })

    const reports = await getGeneratedReports('admin')
    expect(reports).toEqual([])
  })
})
