/**
 * Tests for violation logger write ops.
 *
 * Pins JSON receipt shape (all event fields encoded), event_type prefix
 * "violation:", the 3 typed convenience wrappers (QUOTA_EXCEEDED billable=true,
 * REQUEST_THROTTLED, OVERAGE_BILLED), and graceful failure (returns null
 * on DB error, never throws).
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
  logViolation,
  logQuotaViolation,
  logThrottlingEvent,
  logBillingEvent,
} from './violation-logger-write'
import { logger } from '@/seed/utils/logger-utility'

interface CapturedInsert {
  table: string
  payload: Record<string, unknown>
}

function setupMock(opts: { id?: string; error?: Error } = {}) {
  const captured: CapturedInsert = { table: '', payload: {} }
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
    return {
      select: () => ({
        single: async () => {
          if (opts.error) return { data: null, error: opts.error }
          return { data: { id: opts.id ?? 'v-1' }, error: null }
        },
      }),
    }
  })
  return captured
}

const baseQuotaEvent = {
  userId: 'user-1',
  licenseNonce: 'nonce-abc12345defghijk',
  tier: 'PREMIUM',
  exceededType: 'hourly_credits' as const,
  exceededLimit: 1000,
  exceededCurrent: 1100,
  exceededBy: 100,
  requestedCredits: 50,
  endpoint: '/api/usage',
  ipAddress: '1.2.3.4',
  userAgent: 'Mozilla',
  auditReceiptId: 'receipt-1',
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('logViolation — receipt shape', () => {
  it('writes to audit_logs with event_type "violation:<type>"', async () => {
    const captured = setupMock()
    await logViolation({
      type: 'QUOTA_EXCEEDED',
      ...baseQuotaEvent,
      billable: true,
    })
    expect(captured.table).toBe('audit_logs')
    expect(captured.payload.event_type).toBe('violation:QUOTA_EXCEEDED')
  })

  it('preserves tier + user_id + license_nonce at top level', async () => {
    const captured = setupMock()
    await logViolation({ type: 'QUOTA_EXCEEDED', ...baseQuotaEvent, billable: true })
    expect(captured.payload.user_id).toBe('user-1')
    expect(captured.payload.license_nonce).toBe('nonce-abc12345defghijk')
    expect(captured.payload.tier).toBe('PREMIUM')
  })

  it('serializes full event payload into receipt JSON (snake_case keys)', async () => {
    const captured = setupMock()
    await logViolation({ type: 'QUOTA_EXCEEDED', ...baseQuotaEvent, billable: true })
    const receipt = JSON.parse(captured.payload.receipt as string)
    expect(receipt).toMatchObject({
      type: 'QUOTA_EXCEEDED',
      tier: 'PREMIUM',
      exceeded_type: 'hourly_credits',
      exceeded_limit: 1000,
      exceeded_current: 1100,
      exceeded_by: 100,
      requested_credits: 50,
      endpoint: '/api/usage',
      ip_address: '1.2.3.4',
      user_agent: 'Mozilla',
      billable: true,
      audit_receipt_id: 'receipt-1',
    })
  })

  it('spreads metadata into receipt root (escape hatch for extra fields)', async () => {
    const captured = setupMock()
    await logViolation({
      type: 'OVERAGE_BILLED',
      userId: 'u',
      licenseNonce: 'n',
      tier: 'BASIC',
      metadata: { custom_flag: 'X', nested: { a: 1 } },
    })
    const receipt = JSON.parse(captured.payload.receipt as string)
    expect(receipt.custom_flag).toBe('X')
    expect(receipt.nested).toEqual({ a: 1 })
  })

  it('returns inserted id on success', async () => {
    setupMock({ id: 'vio-xyz' })
    const id = await logViolation({
      type: 'QUOTA_EXCEEDED',
      ...baseQuotaEvent,
      billable: true,
    })
    expect(id).toBe('vio-xyz')
  })

  it('emits warn-level audit log entry with truncated license_nonce', async () => {
    setupMock()
    await logViolation({ type: 'QUOTA_EXCEEDED', ...baseQuotaEvent, billable: true })
    expect(logger.warn).toHaveBeenCalledWith(
      '[Violation Logger] Violation logged',
      expect.objectContaining({
        violationId: 'v-1',
        type: 'QUOTA_EXCEEDED',
        userId: 'user-1',
        licenseNonce: 'nonce-ab...', // first 8 chars + ...
        tier: 'PREMIUM',
        billable: true,
      }),
    )
  })

  it('returns null when DB insert returns an error', async () => {
    setupMock({ error: new Error('FK constraint failed') })
    const id = await logViolation({
      type: 'QUOTA_EXCEEDED',
      ...baseQuotaEvent,
      billable: true,
    })
    expect(id).toBeNull()
    expect(logger.error).toHaveBeenCalled()
  })

  it('returns null when createServerClient throws (non-fatal)', async () => {
    mockCreateServerClient.mockImplementation(() => {
      throw new Error('D1 binding missing')
    })
    const id = await logViolation({
      type: 'QUOTA_EXCEEDED',
      ...baseQuotaEvent,
      billable: true,
    })
    expect(id).toBeNull()
  })
})

describe('logQuotaViolation (wrapper)', () => {
  it('forces billable=true + type=QUOTA_EXCEEDED', async () => {
    const captured = setupMock()
    await logQuotaViolation(baseQuotaEvent)
    expect(captured.payload.event_type).toBe('violation:QUOTA_EXCEEDED')
    const receipt = JSON.parse(captured.payload.receipt as string)
    expect(receipt.billable).toBe(true)
    expect(receipt.type).toBe('QUOTA_EXCEEDED')
  })

  it('returns null on DB error (inherits parent behavior)', async () => {
    setupMock({ error: new Error('fail') })
    expect(await logQuotaViolation(baseQuotaEvent)).toBeNull()
  })
})

describe('logThrottlingEvent (wrapper)', () => {
  it('sets type=REQUEST_THROTTLED (billable not set)', async () => {
    const captured = setupMock()
    await logThrottlingEvent({
      userId: 'u',
      licenseNonce: 'n12345678',
      tier: 'BASIC',
      endpoint: '/api/x',
    })
    expect(captured.payload.event_type).toBe('violation:REQUEST_THROTTLED')
    const receipt = JSON.parse(captured.payload.receipt as string)
    expect(receipt.type).toBe('REQUEST_THROTTLED')
    expect(receipt.endpoint).toBe('/api/x')
  })
})

describe('logBillingEvent (wrapper)', () => {
  it('sets type=OVERAGE_BILLED + passes pricePerCredit + totalCharge', async () => {
    const captured = setupMock()
    await logBillingEvent({
      userId: 'u',
      licenseNonce: 'n12345678',
      tier: 'PREMIUM',
      billable: true,
      pricePerCredit: 0.01,
      totalCharge: 50,
      overageEventId: 'overage-1',
    })
    expect(captured.payload.event_type).toBe('violation:OVERAGE_BILLED')
    const receipt = JSON.parse(captured.payload.receipt as string)
    expect(receipt.type).toBe('OVERAGE_BILLED')
    expect(receipt.billable).toBe(true)
    expect(receipt.price_per_credit).toBe(0.01)
    expect(receipt.total_charge).toBe(50)
    expect(receipt.overage_event_id).toBe('overage-1')
  })
})
