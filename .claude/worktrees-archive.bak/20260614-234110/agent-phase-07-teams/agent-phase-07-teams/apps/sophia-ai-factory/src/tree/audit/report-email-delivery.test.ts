/**
 * Tests for report email delivery (SMTP env-gated, prod-strict).
 *
 * Pins env-based config resolution, prod vs dev fallback (throw vs warn),
 * mock-only logging path when unconfigured, and attachment size logging.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

import { emailReport } from './report-email-delivery'
import { logger } from '@/seed/utils/logger-utility'

const ALL_SMTP_VARS = [
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_USERNAME',
  'SMTP_PASSWORD',
  'SMTP_FROM',
  'SMTP_SECURE',
  'NODE_ENV',
] as const

function stubConfig() {
  vi.stubEnv('SMTP_HOST', 'smtp.example.com')
  vi.stubEnv('SMTP_PORT', '587')
  vi.stubEnv('SMTP_USERNAME', 'user')
  vi.stubEnv('SMTP_PASSWORD', 'pass')
  vi.stubEnv('SMTP_FROM', 'reports@example.com')
}

beforeEach(() => {
  vi.clearAllMocks()
  // Reset all env vars
  for (const v of ALL_SMTP_VARS) vi.stubEnv(v, '')
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('emailReport — unconfigured + non-production', () => {
  it('warns + logs mock-send when SMTP env vars missing (dev)', async () => {
    vi.stubEnv('NODE_ENV', 'development')

    await expect(
      emailReport(['admin@example.com'], 'Compliance Report', Buffer.from('pdf-bytes'), 'report.pdf'),
    ).resolves.toBeUndefined()

    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Email not configured'),
    )
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('Mock email would be sent'),
      expect.objectContaining({
        to: ['admin@example.com'],
        subject: 'Compliance Report',
        attachment: 'report.pdf',
        size: 9,
      }),
    )
  })

  it('reports string attachment length correctly', async () => {
    vi.stubEnv('NODE_ENV', 'development')

    await emailReport(['x@y.z'], 'subj', 'hello world', 'r.txt')

    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('Mock email'),
      expect.objectContaining({ size: 'hello world'.length }),
    )
  })

  it('throws strict error in production when SMTP not configured', async () => {
    vi.stubEnv('NODE_ENV', 'production')

    await expect(
      emailReport(['admin@example.com'], 'subj', Buffer.from('x'), 'r.pdf'),
    ).rejects.toThrow(/Email delivery not configured.*SMTP_HOST.*SMTP_PORT/s)
  })

  it('partial config also triggers prod throw (missing one var = unconfigured)', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('SMTP_HOST', 'smtp.example.com')
    vi.stubEnv('SMTP_PORT', '587')
    // Missing username/password/from

    await expect(emailReport(['x@y.z'], 's', 'a', 'f')).rejects.toThrow(/not configured/)
  })
})

describe('emailReport — fully configured', () => {
  it('logs success when all SMTP env vars present', async () => {
    stubConfig()
    vi.stubEnv('NODE_ENV', 'production')

    await emailReport(['admin@example.com'], 'Compliance Report', Buffer.from('pdf'), 'r.pdf')

    expect(logger.info).toHaveBeenCalledWith(
      '[Report Delivery] Email sent successfully',
      expect.objectContaining({
        recipients: ['admin@example.com'],
        subject: 'Compliance Report',
        filename: 'r.pdf',
      }),
    )
    expect(logger.warn).not.toHaveBeenCalled()
  })

  it('does NOT throw in dev with partial config (warns + falls through to mock)', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    vi.stubEnv('SMTP_HOST', 'smtp.example.com')
    // missing rest

    await expect(emailReport(['x@y.z'], 's', 'a', 'f')).resolves.toBeUndefined()
    expect(logger.warn).toHaveBeenCalled()
  })

  it('parses SMTP_SECURE === "true" as secure flag (string env)', async () => {
    stubConfig()
    vi.stubEnv('SMTP_SECURE', 'true')
    vi.stubEnv('NODE_ENV', 'production')

    // Doesn't throw — config recognized
    await expect(emailReport(['x@y.z'], 's', 'a', 'f')).resolves.toBeUndefined()
  })
})
