/**
 * Tests for audit-query-logger write ops (4 lifecycle audit events).
 *
 * Pins canonical insert shape per action (AUDIT_QUERY / API_KEY_CREATE /
 * API_KEY_REVOKE / API_KEY_VALIDATION_FAILURE) into raas_audit_logs,
 * boolean success contract, swallow-errors-return-false semantics.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockCreateServerClient } = vi.hoisted(() => ({ mockCreateServerClient: vi.fn() }))
vi.mock('@/seed/db/client', () => ({ createServerClient: mockCreateServerClient }))

const { mockInsertTyped } = vi.hoisted(() => ({ mockInsertTyped: vi.fn() }))
vi.mock('@/seed/db/insert-typed', () => ({ insertTyped: mockInsertTyped }))

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

import {
  logAuditQuery,
  logApiKeyCreation,
  logApiKeyRevocation,
  logApiKeyValidationFailure,
} from './audit-query-logger-write'
import { logger } from '@/seed/utils/logger-utility'

interface Captured {
  table: string
  payload: Record<string, unknown>
}

function setupMock(opts: {
  insertError?: { message: string } | Error
  selectError?: Error
  data?: { id: string }
  throwInInsert?: boolean
} = {}) {
  const captured: Captured = { table: '', payload: {} }
  const fromMock = vi.fn((table: string) => {
    captured.table = table
    return {
      __table: table,
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn(),
        single: vi.fn(),
      }),
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnThis(),
      }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnThis(),
      }),
      delete: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnThis(),
      }),
    }
  })
  mockCreateServerClient.mockReturnValue({ from: fromMock })
  mockInsertTyped.mockImplementation((_builder: unknown, payload: Record<string, unknown>) => {
    captured.payload = payload
    if (opts.throwInInsert) throw new Error('insert threw sync')
    const promise = Promise.resolve(
      opts.insertError ? { error: opts.insertError } : { error: null },
    )
    return {
      then: promise.then.bind(promise),
      select: () => ({
        single: async () => {
          if (opts.selectError) return { data: null, error: opts.selectError }
          return { data: opts.data ?? { id: 'log-1' }, error: null }
        },
      }),
    }
  })
  return captured
}

const FIXED_NOW = new Date('2026-05-11T12:00:00Z')
const FIXED_SEC = Math.floor(FIXED_NOW.getTime() / 1000)

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers()
  vi.setSystemTime(FIXED_NOW)
})

describe('logAuditQuery', () => {
  const baseParams = {
    queriedBy: 'admin-1',
    apiKeyId: 'key-1',
    filters: { dateFrom: 1_700_000_000, model: 'gpt-4o' },
    resultCount: 42,
    duration: 150,
    ipAddress: '1.2.3.4',
    userAgent: 'curl/8',
  }

  it('writes to raas_audit_logs with action=AUDIT_QUERY + null license_nonce', async () => {
    const captured = setupMock()
    await logAuditQuery(baseParams)
    expect(captured.table).toBe('raas_audit_logs')
    expect(captured.payload).toMatchObject({
      action: 'AUDIT_QUERY',
      license_nonce: null,
      user_id: 'admin-1',
      ip_address: '1.2.3.4',
      user_agent: 'curl/8',
      created_at: FIXED_SEC,
    })
  })

  it('serializes filters + resultCount + duration into details JSON', async () => {
    const captured = setupMock()
    await logAuditQuery(baseParams)
    expect(captured.payload.details).toMatchObject({
      apiKeyId: 'key-1',
      filters: { dateFrom: 1_700_000_000, model: 'gpt-4o' },
      resultCount: 42,
      duration: 150,
      timestamp: FIXED_SEC,
    })
  })

  it('coerces missing optional ip/userAgent to null', async () => {
    const captured = setupMock()
    await logAuditQuery({ ...baseParams, ipAddress: undefined, userAgent: undefined })
    expect(captured.payload.ip_address).toBeNull()
    expect(captured.payload.user_agent).toBeNull()
  })

  it('returns true + logs info on success', async () => {
    setupMock({ data: { id: 'audit-log-xyz' } })
    expect(await logAuditQuery(baseParams)).toBe(true)
    expect(logger.info).toHaveBeenCalledWith(
      '[Audit Query Logger] Query logged successfully',
      expect.objectContaining({ logId: 'audit-log-xyz', queriedBy: 'admin-1' }),
    )
  })

  it('returns false + logs error when select().single() returns error', async () => {
    setupMock({ selectError: new Error('column missing') })
    expect(await logAuditQuery(baseParams)).toBe(false)
    expect(logger.error).toHaveBeenCalled()
  })

  it('returns false when insertTyped throws synchronously (catch-all path)', async () => {
    setupMock({ throwInInsert: true })
    expect(await logAuditQuery(baseParams)).toBe(false)
    expect(logger.error).toHaveBeenCalled()
  })
})

describe('logApiKeyCreation', () => {
  it('writes action=API_KEY_CREATE with apiKeyId + permissions in details', async () => {
    const captured = setupMock()
    await logApiKeyCreation('user-1', 'key-abc', ['read', 'write'], '1.2.3.4')
    expect(captured.payload).toMatchObject({
      action: 'API_KEY_CREATE',
      license_nonce: null,
      user_id: 'user-1',
      ip_address: '1.2.3.4',
      created_at: FIXED_SEC,
    })
    expect(captured.payload.details).toMatchObject({
      apiKeyId: 'key-abc',
      permissions: ['read', 'write'],
      timestamp: FIXED_SEC,
    })
  })

  it('defaults ipAddress to null when omitted', async () => {
    const captured = setupMock()
    await logApiKeyCreation('user-1', 'key-abc', ['read'])
    expect(captured.payload.ip_address).toBeNull()
  })

  it('returns true on success', async () => {
    setupMock()
    expect(await logApiKeyCreation('u', 'k', ['x'])).toBe(true)
  })

  it('returns false + logs error when DB error (uses error.message wrapper)', async () => {
    setupMock({ insertError: { message: 'duplicate key' } })
    expect(await logApiKeyCreation('u', 'k', ['x'])).toBe(false)
    expect(logger.error).toHaveBeenCalled()
  })
})

describe('logApiKeyRevocation', () => {
  it('writes action=API_KEY_REVOKE with reason + apiKeyId in details', async () => {
    const captured = setupMock()
    await logApiKeyRevocation('user-1', 'key-abc', 'compromised', '1.2.3.4')
    expect(captured.payload.action).toBe('API_KEY_REVOKE')
    expect(captured.payload.details).toMatchObject({
      apiKeyId: 'key-abc',
      reason: 'compromised',
      timestamp: FIXED_SEC,
    })
  })

  it('defaults reason to null when omitted', async () => {
    const captured = setupMock()
    await logApiKeyRevocation('user-1', 'key-abc')
    expect((captured.payload.details as { reason: unknown }).reason).toBeNull()
  })

  it('returns false on DB error', async () => {
    setupMock({ insertError: { message: 'fail' } })
    expect(await logApiKeyRevocation('u', 'k')).toBe(false)
  })
})

describe('logApiKeyValidationFailure', () => {
  it('writes action=API_KEY_VALIDATION_FAILURE with null user_id (no authenticated user)', async () => {
    const captured = setupMock()
    await logApiKeyValidationFailure('key-abc', 'invalid signature', '1.2.3.4')
    expect(captured.payload).toMatchObject({
      action: 'API_KEY_VALIDATION_FAILURE',
      license_nonce: null,
      user_id: null,
      ip_address: '1.2.3.4',
    })
    expect(captured.payload.details).toMatchObject({
      apiKeyId: 'key-abc',
      error: 'invalid signature',
      timestamp: FIXED_SEC,
    })
  })

  it('emits warn-level success log (security-sensitive event)', async () => {
    setupMock()
    await logApiKeyValidationFailure('key-abc', 'wrong key')
    expect(logger.warn).toHaveBeenCalledWith(
      '[Audit Query Logger] API key validation failure logged',
      expect.objectContaining({ apiKeyId: 'key-abc', error: 'wrong key' }),
    )
  })

  it('returns false on insert error', async () => {
    setupMock({ insertError: new Error('fail') })
    expect(await logApiKeyValidationFailure('k', 'e')).toBe(false)
  })

  it('returns false when insertTyped throws synchronously', async () => {
    setupMock({ throwInInsert: true })
    expect(await logApiKeyValidationFailure('k', 'e')).toBe(false)
  })
})
