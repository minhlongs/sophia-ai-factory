/**
 * Tests for ClickBank INS webhook route (tenant-scoped).
 *
 * Provider contract preserved: SHA1 signature header, INS parsing, click
 * attribution, 70/30 commission economics, affiliate_conversions persistence.
 * Tenant safety changed: the signing secret comes from the attributed
 * workspace's stored credential — no global CLICKBANK_INS_SECRET fallback;
 * unattributed callbacks, missing credentials, and storage failures fail
 * closed instead of recording orphan rows or false-acking 200.
 */

// Mock all dependencies before imports
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/land/affiliates/clickbank-signature-verifier', () => ({
  verifyClickBankSignature: vi.fn(),
}))

vi.mock('@/land/affiliates/clickbank-postback-parser', () => ({
  parsePostback: vi.fn(),
}))

vi.mock('@/land/affiliates/conversion-attributor', () => ({
  attributeClick: vi.fn(),
}))

vi.mock('@/land/affiliates/commission-calculator', () => ({
  calcCommission: vi.fn(),
}))

vi.mock('@/land/affiliates/conversion-notifier', () => ({
  notifyConversionEarned: vi.fn(),
}))

vi.mock('@/land/affiliates/credentials', () => ({
  getCredentials: vi.fn(),
}))

vi.mock('@/tree/telegram/sql-rate-limiter', () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true }),
}))

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}))

import { POST } from './route'
import { verifyClickBankSignature } from '@/land/affiliates/clickbank-signature-verifier'
import { parsePostback } from '@/land/affiliates/clickbank-postback-parser'
import { attributeClick } from '@/land/affiliates/conversion-attributor'
import { calcCommission } from '@/land/affiliates/commission-calculator'
import { notifyConversionEarned } from '@/land/affiliates/conversion-notifier'
import { getCredentials } from '@/land/affiliates/credentials'
import { checkRateLimit } from '@/tree/telegram/sql-rate-limiter'
import { NextRequest } from 'next/server'

// Mock D1 binding
const mockRun = vi.fn().mockResolvedValue({ success: true })
const mockFirst = vi.fn()
const mockBind = vi.fn(() => ({ first: mockFirst, run: mockRun }))
const mockPrepare = vi.fn(() => ({ bind: mockBind }))
const mockDb = { prepare: mockPrepare }

function makeRequest(body = '', sig = 'valid-sig'): NextRequest {
  return new NextRequest('https://sophia.agencyos.network/api/webhooks/clickbank', {
    method: 'POST',
    body,
    headers: { 'x-clickbank-signature': sig, 'content-type': 'application/x-www-form-urlencoded' },
  })
}

const basePostback = {
  receipt: 'REC123',
  transactionType: 'SALE' as const,
  amount: 100,
  currency: 'USD',
  cvendthru: 'a1b2c3d4e5f6a7b8c9d0e1f2',
  vendor: 'myvendor',
  affiliate: undefined,
}

const TENANT_SECRET = 'tenant_clickbank_clerk_key'

beforeEach(() => {
  vi.clearAllMocks()
  delete process.env.CLICKBANK_INS_SECRET
  ;(globalThis as unknown as { __env: Record<string, unknown> }).__env = { DB: mockDb }

  vi.mocked(verifyClickBankSignature).mockResolvedValue(true)
  vi.mocked(parsePostback).mockReturnValue(basePostback)
  vi.mocked(attributeClick).mockResolvedValue({
    clickId: 'full-click-uuid',
    campaignId: 'camp-1',
    userId: 'user-1',
    offerId: 'phenq',
  })
  vi.mocked(calcCommission).mockReturnValue({ user: 70, sophia: 30 })
  vi.mocked(getCredentials).mockResolvedValue({
    network: 'clickbank',
    clerk_key: TENANT_SECRET,
  } as unknown as Awaited<ReturnType<typeof getCredentials>>)
  mockFirst.mockResolvedValue(null)  // no duplicate by default
  mockRun.mockResolvedValue({ success: true })
})

describe('POST /api/webhooks/clickbank', () => {
  it('returns 401 for invalid signature', async () => {
    vi.mocked(verifyClickBankSignature).mockResolvedValue(false)

    const res = await POST(makeRequest('body', 'bad-sig'))
    expect(res.status).toBe(401)
  })

  it('verifies against the attributed workspace secret (never a global env secret)', async () => {
    process.env.CLICKBANK_INS_SECRET = 'global_secret_that_must_be_ignored'

    const res = await POST(makeRequest('receipt=REC123&transactionType=SALE&amount=100'))
    expect(res.status).toBe(200)
    expect(getCredentials).toHaveBeenCalledWith(
      expect.anything(),
      'user-1',
      'clickbank',
    )
    expect(verifyClickBankSignature).toHaveBeenCalledWith(
      expect.any(String),
      'valid-sig',
      TENANT_SECRET,
    )
  })

  it('returns 200 and inserts row for valid SALE', async () => {
    const res = await POST(makeRequest('receipt=REC123&transactionType=SALE&amount=100'))

    expect(res.status).toBe(200)
    const json = await res.json() as Record<string, unknown>
    expect(json.ok).toBe(true)
    expect(mockPrepare).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO affiliate_conversions'))
  })

  it('skips duplicate receipt+event_type (idempotency)', async () => {
    mockFirst.mockResolvedValue({ 1: 1 })  // existing row

    const res = await POST(makeRequest())
    expect(res.status).toBe(200)
    const json = await res.json() as Record<string, unknown>
    expect(json.skipped).toBe('duplicate')
    // INSERT should NOT be called
    expect(mockPrepare).not.toHaveBeenCalledWith(expect.stringContaining('INSERT INTO affiliate_conversions'))
  })

  it('fails 422 link_unattributed (no orphan row) when cvendthru is not found', async () => {
    vi.mocked(attributeClick).mockResolvedValue(null)

    const res = await POST(makeRequest())
    expect(res.status).toBe(422)
    const json = await res.json() as Record<string, unknown>
    expect(json).toMatchObject({ ok: false, error: 'link_unattributed' })
    expect(mockPrepare).not.toHaveBeenCalledWith(expect.stringContaining('INSERT INTO affiliate_conversions'))
  })

  it('fails 503 secret_not_configured when the workspace has no credential', async () => {
    vi.mocked(getCredentials).mockResolvedValue(null)

    const res = await POST(makeRequest())
    expect(res.status).toBe(503)
    const json = await res.json() as Record<string, unknown>
    expect(json).toMatchObject({ ok: false, error: 'secret_not_configured', tenantId: 'user-1' })
    expect(verifyClickBankSignature).not.toHaveBeenCalled()
    expect(mockPrepare).not.toHaveBeenCalledWith(expect.stringContaining('INSERT INTO affiliate_conversions'))
  })

  it('fails 503 db_unavailable when the D1 binding is missing', async () => {
    ;(globalThis as unknown as { __env: Record<string, unknown> }).__env = {}

    const res = await POST(makeRequest())
    expect(res.status).toBe(503)
    const json = await res.json() as Record<string, unknown>
    expect(json).toMatchObject({ ok: false, error: 'db_unavailable' })
  })

  it('notifies user on attributed SALE', async () => {
    await POST(makeRequest())
    expect(notifyConversionEarned).toHaveBeenCalledWith('user-1', 70, 'camp-1')
  })

  it('does NOT notify user for TEST event', async () => {
    vi.mocked(parsePostback).mockReturnValue({ ...basePostback, transactionType: 'TEST' as const })

    await POST(makeRequest())
    expect(notifyConversionEarned).not.toHaveBeenCalled()
  })

  it('returns 200 for unparseable body (ack ClickBank)', async () => {
    vi.mocked(parsePostback).mockReturnValue(null)

    const res = await POST(makeRequest('garbage!!'))
    expect(res.status).toBe(200)
    const json = await res.json() as Record<string, unknown>
    expect(json.skipped).toBe('parse_error')
  })

  it('uses negative amount for REFUND', async () => {
    vi.mocked(parsePostback).mockReturnValue({
      ...basePostback,
      transactionType: 'REFUND' as const,
      amount: 50,
    })
    vi.mocked(calcCommission).mockReturnValue({ user: -35, sophia: -15 })

    await POST(makeRequest())
    expect(calcCommission).toHaveBeenCalledWith(-50)
  })

  // C1: TEST events must NOT get +60d clearance window
  it('TEST attributed event → available_at null (no clearance window)', async () => {
    vi.mocked(parsePostback).mockReturnValue({ ...basePostback, transactionType: 'TEST' as const })

    await POST(makeRequest())
    // bind args: id, receipt, click_id, campaign_id, user_id, offer_id,
    //            event_type, gross_amount, currency, commission_user, commission_sophia,
    //            payout_status, available_at, raw_payload
    expect(mockBind).toHaveBeenCalledWith(
      expect.any(String), // id
      'REC123',            // receipt
      'full-click-uuid',   // click_id
      'camp-1',            // campaign_id
      'user-1',            // user_id
      'phenq',             // offer_id
      'TEST',              // event_type
      100,                 // gross_amount
      'USD',               // currency
      70,                  // commission_user
      30,                  // commission_sophia
      'pending_clearance', // payout_status
      null,                // available_at MUST be null for TEST
      expect.any(String),  // raw_payload
    )
  })

  // H1: REFUND must UPDATE by receipt (not click_id), covers 'available' status too
  it('REFUND triggers UPDATE WHERE receipt = ? covering pending_clearance and available', async () => {
    vi.mocked(parsePostback).mockReturnValue({ ...basePostback, transactionType: 'REFUND' as const, amount: 50 })
    vi.mocked(calcCommission).mockReturnValue({ user: -35, sophia: -15 })
    mockRun.mockResolvedValue({ success: true, meta: { changes: 1 } })

    await POST(makeRequest())

    // Check the UPDATE was called with receipt binding (not click_id)
    const updateCall = (mockPrepare.mock.calls as unknown as string[][]).find(
      (args) => typeof args[0] === 'string' && args[0].includes('UPDATE affiliate_conversions')
    )
    expect(updateCall).toBeDefined()
    const updateSql = updateCall![0]
    expect(updateSql).toContain("receipt = ?")
    expect(updateSql).toContain("payout_status IN ('pending_clearance','available')")
    // bind should have received 'REC123' (receipt) not 'full-click-uuid' (click_id)
    expect(mockBind).toHaveBeenCalledWith('REC123')
  })

  // H2: rate limit returns 429
  it('returns 429 when rate limit exceeded', async () => {
    vi.mocked(checkRateLimit).mockResolvedValueOnce({ allowed: false, remaining: 0, resetInSeconds: 60 })

    const res = await POST(makeRequest())
    expect(res.status).toBe(429)
  })

  // H3: UNIQUE constraint error → skipped: duplicate_race (not insert_error)
  it('UNIQUE constraint insert failure → skipped: duplicate_race with 200', async () => {
    mockRun.mockRejectedValueOnce(new Error('UNIQUE constraint failed: affiliate_conversions.receipt'))

    const res = await POST(makeRequest())
    expect(res.status).toBe(200)
    const json = await res.json() as Record<string, unknown>
    expect(json.skipped).toBe('duplicate_race')
  })

  // Storage failures fail LOUD so ClickBank retries: no silent 200 ack.
  it('non-constraint insert failure → 503 db_write_failed', async () => {
    mockRun.mockRejectedValueOnce(new Error('D1_ERROR: disk full'))

    const res = await POST(makeRequest())
    expect(res.status).toBe(503)
    const json = await res.json() as Record<string, unknown>
    expect(json).toMatchObject({ ok: false, error: 'db_write_failed' })
  })
})
