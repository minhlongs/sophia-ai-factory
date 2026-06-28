/**
 * Tests for report storage + delivery (Supabase Storage upload + signed URL download).
 *
 * Pins content-type detection per format, date-prefixed path scheme, upsert default,
 * REPORTS_STORAGE_BUCKET env override, null-on-error semantics for both store + download.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const { mockCreateServerClient } = vi.hoisted(() => ({ mockCreateServerClient: vi.fn() }))
vi.mock('@/seed/db/client', () => ({ createServerClient: mockCreateServerClient }))

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

import { storeReport, downloadStoredReport } from './report-storage-delivery'
import { logger } from '@/seed/utils/logger-utility'

interface UploadCall {
  bucket: string
  path: string
  contentType: string
  upsert: boolean
  byteLength: number
}

function setupStoreMock(opts: {
  uploadError?: { message: string }
  publicUrl?: string
  throwInUpload?: boolean
} = {}) {
  const calls: UploadCall[] = []
  mockCreateServerClient.mockReturnValue({
    storage: {
      from: (bucket: string) => ({
        upload: vi.fn(async (path: string, buf: Buffer, o: { contentType: string; upsert: boolean }) => {
          if (opts.throwInUpload) throw new Error('storage exploded')
          calls.push({ bucket, path, contentType: o.contentType, upsert: o.upsert, byteLength: buf.length })
          return { error: opts.uploadError ?? null }
        }),
        getPublicUrl: vi.fn((_p: string) => ({
          data: { publicUrl: opts.publicUrl ?? 'https://example.cdn/file' },
        })),
      }),
    },
  })
  return { calls }
}

interface DownloadOpts {
  row?: { storage_path: string; format: string } | null
  downloadError?: { message: string }
  buf?: ArrayBuffer
  throwInQuery?: boolean
}

function setupDownloadMock(opts: DownloadOpts = {}) {
  const arrayBuffer = opts.buf ?? new Uint8Array([1, 2, 3, 4]).buffer
  mockCreateServerClient.mockReturnValue({
    from: vi.fn(() => {
      if (opts.throwInQuery) throw new Error('db exploded')
      const builder: Record<string, unknown> = {}
      builder.select = vi.fn(() => builder)
      builder.eq = vi.fn(() => builder)
      builder.single = vi.fn(async () => ({ data: opts.row ?? null, error: null }))
      return builder
    }),
    storage: {
      from: () => ({
        download: vi.fn(async () => ({
          data: { arrayBuffer: async () => arrayBuffer },
          error: opts.downloadError ?? null,
        })),
      }),
    },
  })
}

const FIXED_NOW = new Date('2026-05-11T12:00:00Z')

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers()
  vi.setSystemTime(FIXED_NOW)
  vi.unstubAllEnvs()
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
})

describe('storeReport — path construction', () => {
  it('uses ISO date prefix from current time + reportId + extension', async () => {
    const { calls } = setupStoreMock()
    await storeReport('rpt-1', 'hello', 'csv')
    expect(calls[0].path).toBe('2026-05-11/rpt-1.csv')
  })

  it('uses .pdf extension when format=pdf', async () => {
    const { calls } = setupStoreMock()
    await storeReport('rpt-1', Buffer.from('x'), 'pdf')
    expect(calls[0].path).toBe('2026-05-11/rpt-1.pdf')
  })

  it('uses raw format string as extension for non-pdf (html/json/csv)', async () => {
    const { calls } = setupStoreMock()
    await storeReport('rpt-1', 'x', 'html')
    expect(calls[0].path).toBe('2026-05-11/rpt-1.html')
  })
})

describe('storeReport — content-type detection', () => {
  it.each([
    ['pdf', 'application/pdf'],
    ['csv', 'text/csv'],
    ['json', 'application/json'],
    ['html', 'text/html'],
  ])('maps format %s → content-type %s', async (format, expected) => {
    const { calls } = setupStoreMock()
    await storeReport('rpt-1', 'x', format)
    expect(calls[0].contentType).toBe(expected)
  })

  it('falls back to application/octet-stream for unknown format with no matching extension', async () => {
    const { calls } = setupStoreMock()
    await storeReport('rpt-1', 'x', 'xyz')
    expect(calls[0].contentType).toBe('application/octet-stream')
  })
})

describe('storeReport — bucket env override', () => {
  it('defaults to bucket "compliance-reports" when REPORTS_STORAGE_BUCKET unset', async () => {
    vi.stubEnv('REPORTS_STORAGE_BUCKET', '')
    const { calls } = setupStoreMock()
    await storeReport('rpt-1', 'x', 'csv')
    expect(calls[0].bucket).toBe('compliance-reports')
  })

  it('uses REPORTS_STORAGE_BUCKET env when set', async () => {
    vi.stubEnv('REPORTS_STORAGE_BUCKET', 'custom-bucket')
    const { calls } = setupStoreMock()
    await storeReport('rpt-1', 'x', 'csv')
    expect(calls[0].bucket).toBe('custom-bucket')
  })
})

describe('storeReport — content handling', () => {
  it('passes Buffer through as-is (preserves byte length)', async () => {
    const { calls } = setupStoreMock()
    await storeReport('rpt-1', Buffer.from([1, 2, 3, 4, 5]), 'pdf')
    expect(calls[0].byteLength).toBe(5)
  })

  it('coerces string content to Buffer (utf-8)', async () => {
    const { calls } = setupStoreMock()
    await storeReport('rpt-1', 'héllo', 'csv') // 'é' = 2 bytes utf-8 → 6 total
    expect(calls[0].byteLength).toBe(6)
  })

  it('sets upsert=true (idempotent overwrite)', async () => {
    const { calls } = setupStoreMock()
    await storeReport('rpt-1', 'x', 'csv')
    expect(calls[0].upsert).toBe(true)
  })
})

describe('storeReport — return value', () => {
  it('returns getPublicUrl().data.publicUrl on success', async () => {
    setupStoreMock({ publicUrl: 'https://cdn.example/path/rpt-1.csv' })
    const url = await storeReport('rpt-1', 'x', 'csv')
    expect(url).toBe('https://cdn.example/path/rpt-1.csv')
  })

  it('logs info with reportId + path + url on success', async () => {
    setupStoreMock({ publicUrl: 'https://cdn/x' })
    await storeReport('rpt-9', 'x', 'csv')
    expect(logger.info).toHaveBeenCalledWith(
      '[Report Delivery] Report stored successfully',
      expect.objectContaining({ reportId: 'rpt-9', path: '2026-05-11/rpt-9.csv', url: 'https://cdn/x' }),
    )
  })
})

describe('storeReport — error paths', () => {
  it('returns null + logs error when upload returns error', async () => {
    setupStoreMock({ uploadError: { message: 'bucket missing' } })
    const url = await storeReport('rpt-1', 'x', 'csv')
    expect(url).toBeNull()
    expect(logger.error).toHaveBeenCalled()
  })

  it('returns null when upload throws (catch-all path)', async () => {
    setupStoreMock({ throwInUpload: true })
    const url = await storeReport('rpt-1', 'x', 'csv')
    expect(url).toBeNull()
    expect(logger.error).toHaveBeenCalled()
  })
})

describe('downloadStoredReport — happy path', () => {
  it('returns Buffer constructed from storage download arrayBuffer', async () => {
    setupDownloadMock({
      row: { storage_path: '2026-05-11/rpt-1.csv', format: 'csv' },
      buf: new Uint8Array([10, 20, 30]).buffer,
    })
    const buf = await downloadStoredReport('rpt-1', 'csv')
    expect(buf).toBeInstanceOf(Buffer)
    expect(Array.from(buf!)).toEqual([10, 20, 30])
  })
})

describe('downloadStoredReport — null paths', () => {
  it('returns null + warns when report row not found', async () => {
    setupDownloadMock({ row: null })
    const buf = await downloadStoredReport('missing', 'csv')
    expect(buf).toBeNull()
    expect(logger.warn).toHaveBeenCalledWith(
      '[Report Delivery] Report not found',
      expect.objectContaining({ reportId: 'missing' }),
    )
  })

  it('returns null + logs error when storage download fails', async () => {
    setupDownloadMock({
      row: { storage_path: '2026-05-11/rpt-1.csv', format: 'csv' },
      downloadError: { message: 'object missing' },
    })
    const buf = await downloadStoredReport('rpt-1', 'csv')
    expect(buf).toBeNull()
    expect(logger.error).toHaveBeenCalled()
  })

  it('returns null when DB query throws (catch-all path)', async () => {
    setupDownloadMock({ throwInQuery: true })
    const buf = await downloadStoredReport('rpt-1', 'csv')
    expect(buf).toBeNull()
    expect(logger.error).toHaveBeenCalled()
  })
})
